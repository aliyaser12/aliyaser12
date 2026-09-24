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

```
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
```

}

function setStatus(message) {
const status = document.getElementById("status");
if (status) status.textContent = message;
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

```
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
} else {
    setStatus(
        "تم إنشاء الحساب. افتح رسالة التأكيد في بريدك الإلكتروني."
    );
}
```

}

async function loginUserUI() {
if (!supabaseClient) {
setStatus("Supabase غير متصل.");
return;
}

```
const { email, password } = getValues();

if (!email || !password) {
    setStatus("أدخل البريد الإلكتروني وكلمة المرور.");
    return;
}

setStatus("جاري تسجيل الدخول...");

const { data, error } =
    await supabaseClient.auth.signInWithPassword({
        email,
        password
    });

if (error || !data.session) {
    setStatus("بيانات الدخول غير صحيحة أو الحساب غير مؤكد.");
    return;
}

setStatus("تم تسجيل الدخول بنجاح.");
await updateAuthUI();
```

}

async function logoutUserUI() {
if (!supabaseClient) return;

```
const { error } = await supabaseClient.auth.signOut();

if (error) {
    setStatus("تعذر تسجيل الخروج.");
    return;
}

const authPanel = document.getElementById("authPanel");
const userPanel = document.getElementById("userPanel");

if (authPanel) authPanel.style.display = "block";
if (userPanel) userPanel.style.display = "none";

setStatus("تم تسجيل الخروج.");
```

}

async function getCurrentUser() {
if (!supabaseClient) return null;

```
const {
    data: { user },
    error
} = await supabaseClient.auth.getUser();

if (error) return null;

return user;
```

}

async function updateAuthUI() {
const user = await getCurrentUser();

```
const authPanel = document.getElementById("authPanel");
const userPanel = document.getElementById("userPanel");
const userEmail = document.getElementById("userEmail");

if (!authPanel || !userPanel) return;

if (user) {
    authPanel.style.display = "none";
    userPanel.style.display = "block";

    if (userEmail) {
        userEmail.textContent =
            user.user_metadata?.username ||
            user.email ||
            "مستخدم VANTA";
    }
} else {
    authPanel.style.display = "block";
    userPanel.style.display = "none";
}
```

}

window.VANTA_AUTH = {
getCurrentUser,
registerUserUI,
loginUserUI,
logoutUserUI
};

document.addEventListener("DOMContentLoaded", async () => {
if (!initSupabase()) {
setStatus("تعذر تحميل نظام المصادقة.");
return;
}

```
await updateAuthUI();

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
```

});
