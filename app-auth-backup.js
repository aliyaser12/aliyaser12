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
    if (!supabaseClient) return { error: "Supabase غير متصل" };

    const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
            data: {
                username
            }
        }
    });

    return { data, error };
}

async function loginUser(email, password) {
    if (!supabaseClient) return { error: "Supabase غير متصل" };

    const { data, error } =
        await supabaseClient.auth.signInWithPassword({
            email,
            password
        });

    return { data, error };
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

function notify(message) {
    const old = document.getElementById("vanta-notification");
    if (old) old.remove();

    const box = document.createElement("div");

    box.id = "vanta-notification";
    box.textContent = message;

    Object.assign(box.style, {
        position: "fixed",
        bottom: "25px",
        right: "25px",
        padding: "14px 20px",
        background: "#0d141d",
        color: "#00ff9d",
        border: "1px solid rgba(0,255,157,.4)",
        borderRadius: "10px",
        zIndex: "99999",
        boxShadow: "0 0 25px rgba(0,255,157,.15)"
    });

    document.body.appendChild(box);

    setTimeout(() => box.remove(), 3000);
}

document.addEventListener("DOMContentLoaded", async () => {
    if (!initSupabase()) return;

    const user = await getCurrentUser();

    if (user) {
        console.log("VANTA: User session active.");
        console.log("User:", user.email);
    } else {
        console.log("VANTA: No active session.");
    }

    console.log(
        "%cVANTA × ALI YASER",
        "color:#00ff9d;font-size:24px;font-weight:bold"
    );

    console.log("Cybersecurity • Education • Research");
});
