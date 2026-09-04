"use strict";

let supabaseClient = null;

function initSupabase() {
    if (
        typeof window.supabase === "undefined" ||
        typeof SUPABASE_URL === "undefined" ||
        typeof SUPABASE_PUBLISHABLE_KEY === "undefined"
    ) {
        console.error("VANTA: Supabase configuration not loaded.");
        return false;
    }

    supabaseClient = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY,
        {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true
            }
        }
    );

    return true;
}

function setStatus(message) {
    const status = document.getElementById("status");

    if (status) {
        status.textContent = message;
    }
}

function getValues() {
    return {
        email: document.getElementById("email")?.value.trim() || "",
        password: document.getElementById("password")?.value || "",
        username: document.getElementById("username")?.value.trim() || ""
    };
}

async function registerUserUI() {
    if (!supabaseClient) {
        setStatus("Supabase غير متصل.");
        return;
    }

    const { email, password, username } = getValues();

    if (!email || !password) {
        setStatus("أدخل البريد الإلكتروني وكلمة المرور.");
        return;
    }

    if (password.length < 6) {
        setStatus("كلمة المرور يجب أن تكون 6 أحرف على الأقل.");
        return;
    }

    setStatus("جاري إنشاء الحساب...");

    const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
            data: {
                username
            }
        }
    });

    if (error) {
        setStatus("فشل إنشاء الحساب: " + error.message);
        return;
    }

    if (data.session) {
        setStatus("تم إنشاء الحساب وتسجيل الدخول.");
        await updateAuthUI();
        return;
    }

    setStatus(
        "تم إنشاء الحساب. افتح رسالة التأكيد في بريدك الإلكتروني ثم ارجع إلى VANTA."
    );
}

async function loginUserUI() {
    if (!supabaseClient) {
        setStatus("Supabase غير متصل.");
        return;
    }

    const { email, password } = getValues();

    if (!email || !password) {
        setStatus("أدخل البريد الإلكتروني وكلمة المرور.");
        return;
    }

    setStatus("جاري التحقق من بيانات الدخول...");

    const { data, error } =
        await supabaseClient.auth.signInWithPassword({
            email,
            password
        });

    if (error) {
        setStatus("بيانات الدخول غير صحيحة أو الحساب غير مؤكد.");
        console.error("VANTA login:", error.message);
        return;
    }

    if (!data.session) {
        setStatus("لم يتم إنشاء جلسة دخول.");
        return;
    }

    setStatus("تم تسجيل الدخول بنجاح.");
    await updateAuthUI();
}

async function logoutUserUI() {
    if (!supabaseClient) return;

    const { error } = await supabaseClient.auth.signOut();

    if (error) {
        setStatus("تعذر تسجيل الخروج.");
        console.error("VANTA logout:", error.message);
        return;
    }

    document.getElementById("authPanel").style.display = "block";
    document.getElementById("userPanel").style.display = "none";

    document.getElementById("email").value = "";
    document.getElementById("password").value = "";
    document.getElementById("username").value = "";

    setStatus("تم تسجيل الخروج.");
}

async function getCurrentUser() {
    if (!supabaseClient) return null;

    const {
        data: { user },
        error
    } = await supabaseClient.auth.getUser();

    if (error) {
        console.error("VANTA user:", error.message);
        return null;
    }

    return user;
}

async function updateAuthUI() {
    const user = await getCurrentUser();

    const authPanel = document.getElementById("authPanel");
    const userPanel = document.getElementById("userPanel");
    const userEmail = document.getElementById("userEmail");

    if (!authPanel || !userPanel) return;

    if (user) {
        authPanel.style.display = "none";
        userPanel.style.display = "block";

        if (userEmail) {
            userEmail.textContent = user.email || "مستخدم VANTA";
        }
    } else {
        authPanel.style.display = "block";
        userPanel.style.display = "none";
    }
}

function handleEmailConfirmation() {
    const hash = window.location.hash;

    if (!hash.includes("access_token=")) {
        return false;
    }

    setStatus("تم تأكيد البريد الإلكتروني. جاري فتح حسابك...");

    window.history.replaceState(
        {},
        document.title,
        window.location.pathname
    );

    return true;
}

document.addEventListener("DOMContentLoaded", async () => {
    if (!initSupabase()) {
        setStatus("تعذر تحميل نظام المصادقة.");
        return;
    }

    const confirmationLink = handleEmailConfirmation();

    if (confirmationLink) {
        setTimeout(async () => {
            await updateAuthUI();
        }, 500);
    } else {
        await updateAuthUI();
    }

    supabaseClient.auth.onAuthStateChange((event, session) => {
        console.log("VANTA Auth:", event);

        if (session) {
            updateAuthUI();
        } else {
            updateAuthUI();
        }
    });

    console.log(
        "%cVANTA × ALI YASER",
        "color:#00ff9d;font-size:24px;font-weight:bold"
    );

    console.log("Cybersecurity • Education • Research");
});
