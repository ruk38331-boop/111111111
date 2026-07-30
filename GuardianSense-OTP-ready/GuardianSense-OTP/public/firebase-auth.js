import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import {
    getAuth,
    RecaptchaVerifier,
    signInWithPhoneNumber,
    GoogleAuthProvider,
    signInWithPopup,
    signOut
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyC7JQCILvjjHcGn-hknMhjQvTZWrvF0LBY",
    authDomain: "guardiansense-31cff.firebaseapp.com",
    projectId: "guardiansense-31cff",
    storageBucket: "guardiansense-31cff.firebasestorage.app",
    messagingSenderId: "607781260250",
    appId: "1:607781260250:web:500a182e3124300f09cee3",
    measurementId: "G-R1NF9BSHZ2"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
auth.languageCode = "ar";

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

const googleButton = document.getElementById("google-signin-button");
const googleMessage = document.getElementById("google-auth-message");
const googleButtonLabel = googleButton?.querySelector("span");

function setGoogleMessage(message = "", isError = false) {
    if (!googleMessage) return;
    googleMessage.textContent = message;
    googleMessage.className = message
        ? `form-status show ${isError ? "error" : "success"}`
        : "form-status";
}

function googleErrorMessage(error) {
    const messages = {
        "auth/popup-closed-by-user": "أُغلقت نافذة Google قبل إكمال تسجيل الدخول.",
        "auth/cancelled-popup-request": "توجد محاولة تسجيل دخول أخرى مفتوحة.",
        "auth/popup-blocked": "المتصفح منع نافذة Google. اسمح بالنوافذ المنبثقة ثم أعد المحاولة.",
        "auth/unauthorized-domain": "نطاق الموقع غير مضاف إلى Authorized domains في Firebase.",
        "auth/operation-not-allowed": "فعّل Google من Authentication ثم Sign-in method داخل Firebase.",
        "auth/network-request-failed": "تعذر الاتصال بـ Firebase. تحقق من الإنترنت وحاول مجددًا.",
        "auth/api-key-not-valid.-please-pass-a-valid-api-key.": "مفتاح Firebase غير صحيح. أعد نسخ إعدادات تطبيق الويب.",
        "auth/account-exists-with-different-credential": "يوجد حساب بهذا البريد باستخدام طريقة دخول مختلفة."
    };
    return messages[error?.code] || `تعذر تسجيل الدخول باستخدام Google: ${error?.code || "خطأ غير معروف"}`;
}

googleButton?.addEventListener("click", async () => {
    googleButton.disabled = true;
    if (googleButtonLabel) googleButtonLabel.textContent = "جارٍ فتح Google...";
    setGoogleMessage("");

    try {
        const result = await signInWithPopup(auth, googleProvider);
        if (typeof window.handleGuardianGoogleSignIn !== "function") {
            throw new Error("تعذر ربط حساب Google بواجهة الموقع.");
        }
        await window.handleGuardianGoogleSignIn({
            uid: result.user.uid,
            displayName: result.user.displayName,
            email: result.user.email,
            emailVerified: result.user.emailVerified,
            photoURL: result.user.photoURL,
            phoneNumber: result.user.phoneNumber
        });
        setGoogleMessage("تم تسجيل الدخول باستخدام Google بنجاح.");
    } catch (error) {
        console.error("Firebase Google sign-in error:", error);
        const message = error?.code ? googleErrorMessage(error) : (error?.message || "تعذر تسجيل الدخول باستخدام Google.");
        setGoogleMessage(message, true);
    } finally {
        googleButton.disabled = false;
        if (googleButtonLabel) googleButtonLabel.textContent = "المتابعة باستخدام Google";
    }
});

window.signOutGuardianFirebase = () => signOut(auth);

const phoneInput = document.getElementById("reg-phone");
const sendButton = document.getElementById("send-otp-button");
const verifyButton = document.getElementById("verify-otp-button");
const otpInput = document.getElementById("otp-code");
const otpBox = document.getElementById("otp-box");
const otpMessage = document.getElementById("otp-message");
const verificationBadge = document.getElementById("phone-verification-badge");

let confirmationResult = null;
let verifiedPhone = null;
let recaptchaVerifier = null;

function normalizeSaudiPhone(value) {
    const digits = String(value || "").replace(/\D/g, "");

    if (/^05\d{8}$/.test(digits)) return `+966${digits.slice(1)}`;
    if (/^5\d{8}$/.test(digits)) return `+966${digits}`;
    if (/^9665\d{8}$/.test(digits)) return `+${digits}`;

    return null;
}

function setOtpMessage(message = "", isError = false) {
    if (!otpMessage) return;
    otpMessage.textContent = message;
    otpMessage.className = isError
        ? "text-sm font-bold text-red-700"
        : "text-sm font-bold text-green-700";
}

function clearRecaptcha() {
    try {
        recaptchaVerifier?.clear();
    } catch (error) {
        console.warn("تعذر إعادة تهيئة reCAPTCHA:", error);
    }
    recaptchaVerifier = null;
}

function getRecaptchaVerifier() {
    if (!recaptchaVerifier && sendButton) {
        recaptchaVerifier = new RecaptchaVerifier(auth, "send-otp-button", {
            size: "invisible",
            callback: () => {},
            "expired-callback": () => {
                setOtpMessage("انتهت صلاحية التحقق الأمني. أعد إرسال الرمز.", true);
                clearRecaptcha();
            }
        });
    }
    return recaptchaVerifier;
}

function resetVerifiedState(message = "") {
    verifiedPhone = null;
    confirmationResult = null;
    if (phoneInput) phoneInput.readOnly = false;
    if (otpInput) otpInput.readOnly = false;
    if (sendButton) sendButton.disabled = false;
    if (verifyButton) verifyButton.disabled = false;
    verificationBadge?.classList.add("hidden");
    if (message) setOtpMessage(message, true);
}

sendButton?.addEventListener("click", async () => {
    const phoneNumber = normalizeSaudiPhone(phoneInput?.value);

    if (!phoneNumber) {
        setOtpMessage("أدخل رقمًا سعوديًا صحيحًا مثل 05XXXXXXXX.", true);
        phoneInput?.focus();
        return;
    }

    sendButton.disabled = true;
    sendButton.textContent = "جارٍ إرسال الرمز...";
    setOtpMessage("");

    try {
        confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, getRecaptchaVerifier());
        otpBox?.classList.remove("hidden");
        if (otpInput) {
            otpInput.value = "";
            otpInput.focus();
        }
        setOtpMessage(`تم إرسال رمز التحقق إلى ${phoneNumber}`);
        sendButton.textContent = "إعادة إرسال الرمز";
    } catch (error) {
        console.error("Firebase OTP send error:", error);

        const messages = {
            "auth/invalid-phone-number": "رقم الجوال غير صحيح.",
            "auth/too-many-requests": "محاولات كثيرة. انتظر قليلًا ثم أعد المحاولة.",
            "auth/quota-exceeded": "تم استهلاك حصة رسائل SMS اليومية للمشروع.",
            "auth/captcha-check-failed": "فشل التحقق الأمني. أعد المحاولة.",
            "auth/operation-not-allowed": "تسجيل الدخول برقم الجوال غير مفعّل في Firebase.",
            "auth/unauthorized-domain": "نطاق الموقع غير مصرح به داخل Firebase Authentication.",
            "auth/missing-phone-number": "أدخل رقم الجوال أولًا.",
            "auth/billing-not-enabled": "الرسائل الحقيقية تحتاج تفعيل الفوترة في Firebase. استخدم تسجيل Google المجاني بدلًا منها."
        };

        setOtpMessage(messages[error.code] || `تعذر إرسال الرمز: ${error.code || "خطأ غير معروف"}`, true);
        confirmationResult = null;
        clearRecaptcha();
        sendButton.textContent = "إرسال رمز التحقق";
    } finally {
        if (!verifiedPhone) sendButton.disabled = false;
    }
});

verifyButton?.addEventListener("click", async () => {
    const code = otpInput?.value.trim() || "";

    if (!confirmationResult) {
        setOtpMessage("اضغط «إرسال رمز التحقق» أولًا.", true);
        return;
    }

    if (!/^\d{6}$/.test(code)) {
        setOtpMessage("أدخل رمز التحقق المكوّن من 6 أرقام.", true);
        otpInput?.focus();
        return;
    }

    verifyButton.disabled = true;
    verifyButton.textContent = "جارٍ التحقق...";

    try {
        const result = await confirmationResult.confirm(code);
        verifiedPhone = result.user.phoneNumber;

        if (phoneInput) {
            phoneInput.value = verifiedPhone;
            phoneInput.readOnly = true;
        }
        if (otpInput) otpInput.readOnly = true;
        sendButton.disabled = true;
        verificationBadge?.classList.remove("hidden");
        setOtpMessage("تم توثيق رقم الجوال بنجاح ✅");
    } catch (error) {
        console.error("Firebase OTP verification error:", error);
        setOtpMessage(error.code === "auth/code-expired" ? "انتهت صلاحية الرمز. أرسل رمزًا جديدًا." : "رمز التحقق غير صحيح أو انتهت صلاحيته.", true);
    } finally {
        verifyButton.disabled = false;
        verifyButton.textContent = "تأكيد الرمز";
    }
});

phoneInput?.addEventListener("input", () => {
    if (!verifiedPhone) return;
    const currentPhone = normalizeSaudiPhone(phoneInput.value);
    if (currentPhone !== verifiedPhone) resetVerifiedState("تم تغيير الرقم؛ يجب توثيقه من جديد.");
});

const registerForm = document.getElementById("register-form");
registerForm?.addEventListener("reset", () => {
    window.setTimeout(() => {
        resetVerifiedState();
        clearRecaptcha();
        otpBox?.classList.add("hidden");
        if (otpInput) otpInput.value = "";
        if (sendButton) sendButton.textContent = "إرسال رمز التحقق";
        setOtpMessage("");
    }, 0);
});

window.isGuardianPhoneVerified = () => {
    const currentPhone = normalizeSaudiPhone(phoneInput?.value);
    return Boolean(verifiedPhone && currentPhone === verifiedPhone);
};
