"use strict";

const crypto = require("crypto");
const nodemailer = require("nodemailer");
const admin = require("firebase-admin");
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");

admin.initializeApp();

const db = admin.firestore();
const { FieldValue, Timestamp } = admin.firestore;

const ADMIN_EMAIL = defineSecret("ADMIN_EMAIL");
const SMTP_USER = defineSecret("SMTP_USER");
const SMTP_PASS = defineSecret("SMTP_PASS");
const MAIL_FROM = defineSecret("MAIL_FROM");

const SITE_NAME = "ト術 奏亨門 / 富永祥玲の鑑定室";
const RATE_LIMIT_SECONDS = 30;
const MAX_TEXT_LENGTH = 4000;

const normalizeText = (value, maxLength = MAX_TEXT_LENGTH) =>
  String(value ?? "").replace(/\r\n/g, "\n").trim().slice(0, maxLength);

const hasNonAscii = (value) => /[^\x00-\x7F]/.test(String(value || ""));
const isValidEmail = (value) => /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/.test(value);
const isValidPhone = (value) => !value || /^[0-9]{10,11}$/.test(value);

const normalizeBoolean = (value) => value === true || value === "true" || value === "on" || value === "1";

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const getTokyoDateParts = () => {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(formatter.formatToParts(new Date()).map((part) => [part.type, part.value]));
  return {
    dateKey: `${parts.year}${parts.month}${parts.day}`,
    display: `${parts.year}/${parts.month}/${parts.day} ${parts.hour}:${parts.minute}`,
  };
};

const getClientIp = (request) => {
  const forwarded = request.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.ip || "";
};

const hashValue = (value) => crypto.createHash("sha256").update(String(value || "unknown")).digest("hex");

const successResponse = (managementId = "") => ({
  ok: true,
  managementId,
  message: "送信が完了しました。",
});

const fail = (status, message = "送信できませんでした。時間をおいて再度お試しください。") => {
  const error = new Error(message);
  error.status = status;
  throw error;
};

const validatePayload = (payload) => {
  const formType = normalizeText(payload.formType, 20);
  if (!["reserve", "kouza"].includes(formType)) fail(400);

  const rawEmail = normalizeText(payload.email, 254);
  const rawPhone = normalizeText(payload.phone || payload.contact, 40);
  if (hasNonAscii(rawEmail) || hasNonAscii(rawPhone)) fail(400);

  const base = {
    formType,
    typeLabel: formType === "reserve" ? "鑑定申込み" : "講座申込み",
    name: normalizeText(payload.name, 120),
    email: rawEmail,
    phone: rawPhone,
    message: normalizeText(payload.message),
    honeypot: normalizeText(payload.honeypot || payload.website, 200),
  };

  if (!base.name || !base.email || !base.message) fail(400);
  if (!isValidEmail(base.email) || !isValidPhone(base.phone)) fail(400);

  if (formType === "reserve") {
    const data = {
      ...base,
      birthDate: normalizeText(payload.birthDate || payload.birth_date, 40),
      birthTime: normalizeText(payload.birthTime, 40),
      birthTimeUnknown: normalizeBoolean(payload.birthTimeUnknown || payload.birth_time_unknown),
      birthPlace: normalizeText(payload.birthPlace || payload.birth_place, 160),
      consultationType: normalizeText(payload.consultationType || payload.type, 160),
      disclaimerChecked: normalizeBoolean(payload.disclaimerChecked || payload.agreement),
      courseName: "",
      preferredSchedule: "",
      learningExperience: "",
    };
    if (!data.birthDate || !data.birthPlace || !data.consultationType || !data.disclaimerChecked) fail(400);
    return data;
  }

  const data = {
    ...base,
    birthDate: "",
    birthTime: "",
    birthTimeUnknown: false,
    birthPlace: "",
    consultationType: "",
    disclaimerChecked: false,
    courseName: normalizeText(payload.courseName || payload.course_type, 160),
    preferredSchedule: normalizeText(payload.preferredSchedule || payload.start_timing, 160),
    learningExperience: normalizeText(payload.learningExperience || payload.experience, 160),
  };
  if (!data.courseName || !data.preferredSchedule) fail(400);
  return data;
};

const buildMailText = (submission, receivedAt) => {
  const common = [
    `管理番号：${submission.managementId}`,
    `申込み種別：${submission.typeLabel}`,
    `受付日時：${receivedAt}`,
    "",
    `お名前：${submission.name}`,
    `メール：${submission.email}`,
    `電話番号：${submission.phone || "未入力"}`,
    "",
  ];

  const details =
    submission.formType === "reserve"
      ? [
          `生年月日：${submission.birthDate}`,
          `出生時間：${submission.birthTime || "未入力"}`,
          `出生時間不明：${submission.birthTimeUnknown ? "はい" : "いいえ"}`,
          `出生場所：${submission.birthPlace}`,
          `希望鑑定方法：${submission.consultationType}`,
          "",
          "ご相談内容：",
          submission.message,
        ]
      : [
          `希望講座：${submission.courseName}`,
          `希望日程や希望内容：${submission.preferredSchedule}`,
          `学習経験：${submission.learningExperience || "未入力"}`,
          "",
          "講座に関するメッセージ：",
          submission.message,
        ];

  return [...common, ...details, "", "この申込みはFirestoreにも保存されています。", "今後ダッシュボードを作る場合は、上記の管理番号で参照できます。"].join("\n");
};

const buildMailHtml = (text) =>
  `<div style="font-family:-apple-system,BlinkMacSystemFont,'Noto Sans JP',sans-serif;line-height:1.8;white-space:pre-wrap;">${escapeHtml(text)}</div>`;

const createTransporter = () =>
  nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: SMTP_USER.value(),
      pass: SMTP_PASS.value(),
    },
  });

exports.submitForm = onRequest(
  {
    region: "asia-northeast1",
    invoker: "public",
    secrets: [ADMIN_EMAIL, SMTP_USER, SMTP_PASS, MAIL_FROM],
  },
  async (request, response) => {
    response.set("Vary", "Origin");

    if (request.method === "OPTIONS") {
      response.set("Access-Control-Allow-Methods", "POST, OPTIONS");
      response.set("Access-Control-Allow-Headers", "Content-Type");
      response.status(204).send("");
      return;
    }

    if (request.method !== "POST") {
      response.status(405).json({ ok: false, message: "Method Not Allowed" });
      return;
    }

    try {
      const payload = request.body || {};
      const data = validatePayload(payload);

      if (data.honeypot) {
        response.status(200).json(successResponse());
        return;
      }

      const { dateKey, display: receivedAt } = getTokyoDateParts();
      const ipHash = hashValue(`${dateKey}:${getClientIp(request)}`);
      const userAgent = normalizeText(request.get("user-agent"), 500);
      const counterRef = db.collection("counters").doc(`submissions_${dateKey}`);
      const rateLimitRef = db.collection("rateLimits").doc(`${dateKey}_${ipHash.slice(0, 32)}`);

      const submission = await db.runTransaction(async (transaction) => {
        const now = Timestamp.now();
        const [counterSnapshot, rateLimitSnapshot] = await Promise.all([
          transaction.get(counterRef),
          transaction.get(rateLimitRef),
        ]);

        if (rateLimitSnapshot.exists) {
          const lastSubmittedAt = rateLimitSnapshot.get("lastSubmittedAt");
          if (lastSubmittedAt && now.seconds - lastSubmittedAt.seconds < RATE_LIMIT_SECONDS) {
            fail(429);
          }
        }

        const nextCount = (counterSnapshot.exists ? counterSnapshot.get("count") || 0 : 0) + 1;
        const managementId = `${dateKey}-${String(nextCount).padStart(3, "0")}`;
        const submissionRef = db.collection("submissions").doc(managementId);
        const submissionData = {
          managementId,
          formType: data.formType,
          typeLabel: data.typeLabel,
          status: "未対応",
          name: data.name,
          email: data.email,
          phone: data.phone,
          birthDate: data.birthDate,
          birthTime: data.birthTime,
          birthTimeUnknown: data.birthTimeUnknown,
          birthPlace: data.birthPlace,
          consultationType: data.consultationType,
          courseName: data.courseName,
          preferredSchedule: data.preferredSchedule,
          learningExperience: data.learningExperience,
          message: data.message,
          rawPayload: data,
          adminMemo: "",
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          source: "web",
          userAgent,
          ipHash,
        };

        transaction.set(counterRef, {
          date: dateKey,
          count: nextCount,
          updatedAt: FieldValue.serverTimestamp(),
        });
        transaction.set(rateLimitRef, {
          ipHash,
          lastSubmittedAt: now,
          updatedAt: FieldValue.serverTimestamp(),
        });
        transaction.set(submissionRef, submissionData);
        return submissionData;
      });

      const subject = `【${submission.typeLabel}】${submission.managementId} ${SITE_NAME}`;
      const text = buildMailText(submission, receivedAt);
      await createTransporter().sendMail({
        to: ADMIN_EMAIL.value(),
        from: MAIL_FROM.value(),
        subject,
        text,
        html: buildMailHtml(text),
      });

      response.status(200).json(successResponse(submission.managementId));
    } catch (error) {
      console.error("submitForm failed", error);
      response.status(error.status || 500).json({
        ok: false,
        message: "送信できませんでした。時間をおいて再度お試しください。",
      });
    }
  }
);
