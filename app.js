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
        SUPABASE_PUBLISHABLE_KEY
    );

    return true;
}

async function registerUser(email, password, username = "") {
    if (!supabaseClient) {
        return { error: { message: "Supabase غير متصل" } };
    }

    return await supabaseClient.auth.signUp({
        email,
        password,
        options: {
            data: {
                username: username.trim()
            }
        }
    });
}

async function loginUser(email, password) {
    if (!supabaseClient) {
        return { error: { message: "Supabase غير متصل" } };
    }

    return await supabaseClient.auth.signInWithPassword({
        email,
        password
    });
}

async function logoutUser() {
    if (!supabaseClient) return;

    const { error } = await supabaseClient.auth.signOut();

    if (error) {
        console.error("VANTA logout error:", error);
    }
}

async function getCurrentUser() {
    if (!supabaseClient) return null;

    const {
        data: { user },
        error
    } = await supabaseClient.auth.getUser();

    if (error) {
        console.error("VANTA user error:", error);
        return null;
    }

    return user;
}

function setStatus(message) {
    const status = document.getElementById("status");

    if (status) {
        status.textContent = message;
    }
}

function getAuthValues() {
    return {
        email: document.getElementById("email")?.value.trim() || "",
        password: document.getElementById("password")?.value || "",
        username: document.getElementById("username")?.value.trim() || ""
    };
}

async function registerUserUI() {
    const { email, password, username } = getAuthValues();

    if (!email || !password) {
        setStatus("أدخل البريد الإلكتروني وكلمة المرور.");
        return;
    }

    setStatus("جاري إنشاء الحساب...");

    const { data, error } = await registerUser(
        email,
        password,
        username
    );

    if (error) {
        setStatus("فشل إنشاء الحساب: " + error.message);
        return;
    }

    if (data.session) {
        setStatus("تم إنشاء الحساب وتسجيل الدخول.");
        await updateAuthUI();
    } else {
        setStatus(
            "تم إنشاء الحساب. تحقق من بريدك الإلكتروني لتأكيد الحساب."
        );
    }
}

async function loginUserUI() {
    const { email, password } = getAuthValues();

    if (!email || !password) {
        setStatus("أدخل البريد الإلكتروني وكلمة المرور.");
        return;
    }

    setStatus("جاري تسجيل الدخول...");

    const { data, error } = await loginUser(
        email,
        password
    );

    if (error) {
        setStatus("فشل تسجيل الدخول: " + error.message);
        return;
    }

    if (data.user) {
        setStatus("تم تسجيل الدخول بنجاح.");
        await updateAuthUI();
    }
}

async function logoutUserUI() {
    await logoutUser();

    document.getElementById("authPanel").style.display = "block";
    document.getElementById("userPanel").style.display = "none";

    setStatus("تم تسجيل الخروج.");
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

document.addEventListener("DOMContentLoaded", async () => {
    if (!initSupabase()) {
        setStatus("تعذر الاتصال بـ Supabase.");
        return;
    }

    await updateAuthUI();

    supabaseClient.auth.onAuthStateChange(() => {
        updateAuthUI();
    });

    console.log(
        "%cVANTA × ALI YASER",
        "color:#00ff9d;font-size:24px;font-weight:bold"
    );

    console.log(
        "Cybersecurity • Education • Research"
    );
});
