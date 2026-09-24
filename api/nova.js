<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">

    <title>VANTA — عالمك التقني</title>
    <meta name="description" content="VANTA — منصة عربية للتعلم والتقنية والذكاء الاصطناعي والمجتمع.">
    <meta name="theme-color" content="#0b1020">

    <link rel="icon" href="vanta-logo.png">

    <!-- Supabase -->
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

    <!-- Main stylesheet -->
    <link rel="stylesheet" href="style.css">
</head>

<body>

    <!-- =========================================
         VANTA BACKGROUND
    ========================================== -->

    <div class="vanta-background">
        <div class="orb orb-one"></div>
        <div class="orb orb-two"></div>
        <div class="orb orb-three"></div>

        <div class="stars"></div>
        <div class="grid-overlay"></div>
    </div>


    <!-- =========================================
         TOP NAVIGATION
    ========================================== -->

    <header class="topbar">

        <a href="index.html" class="brand">
            <div class="brand-logo">
                V
            </div>

            <div class="brand-text">
                <strong>VANTA</strong>
                <span>عالمك التقني</span>
            </div>
        </a>


        <nav class="desktop-nav">

            <a href="#home" class="nav-link active">
                الرئيسية
            </a>

            <a href="#features" class="nav-link">
                المميزات
            </a>

            <a href="#vantabook" class="nav-link">
                VANTABOOK
            </a>

            <a href="#nova" class="nav-link">
                NOVA
            </a>

        </nav>


        <div class="top-actions">

            <button
                type="button"
                class="ghost-button"
                id="openLoginTop"
            >
                تسجيل الدخول
            </button>

            <button
                type="button"
                class="primary-button"
                id="openSignupTop"
            >
                ابدأ الآن
            </button>

        </div>

    </header>



    <!-- =========================================
         HERO
    ========================================== -->

    <main>

        <section class="hero" id="home">

            <div class="hero-content">

                <div class="hero-badge">
                    <span class="status-dot"></span>
                    منصة تقنية عربية جديدة
                </div>


                <h1>
                    مرحبًا بك في
                    <span class="gradient-text">VANTA</span>
                </h1>


                <p class="hero-description">
                    عالم واحد يجمع التعلم، الذكاء الاصطناعي،
                    الأمن السيبراني، البرمجة ومجتمعًا تقنيًا
                    حقيقيًا في مكان واحد.
                </p>


                <div class="hero-actions">

                    <button
                        type="button"
                        class="hero-primary"
                        id="openSignupHero"
                    >
                        ابدأ رحلتك
                        <span>←</span>
                    </button>

                    <button
                        type="button"
                        class="hero-secondary"
                        id="exploreButton"
                    >
                        اكتشف VANTA
                    </button>

                </div>


                <div class="hero-stats">

                    <div class="stat">
                        <strong>∞</strong>
                        <span>إمكانيات</span>
                    </div>

                    <div class="stat">
                        <strong>AI</strong>
                        <span>NOVA</span>
                    </div>

                    <div class="stat">
                        <strong>24/7</strong>
                        <span>تعلم</span>
                    </div>

                </div>

            </div>


            <!-- VANTA CHARACTER -->

            <div class="hero-visual">

                <div class="character-glow"></div>

                <div class="vanta-character">

                    <div class="character-ring"></div>

                    <div class="character-core">
                        V
                    </div>

                    <div class="character-eye eye-one"></div>
                    <div class="character-eye eye-two"></div>

                </div>


                <div class="floating-card card-one">
                    <span>⚡</span>
                    <div>
                        <strong>تعلّم</strong>
                        <small>بطريقتك</small>
                    </div>
                </div>


                <div class="floating-card card-two">
                    <span>🤖</span>
                    <div>
                        <strong>NOVA</strong>
                        <small>معك دائمًا</small>
                    </div>
                </div>


                <div class="floating-card card-three">
                    <span>🌐</span>
                    <div>
                        <strong>VANTABOOK</strong>
                        <small>مجتمعك</small>
                    </div>
                </div>

            </div>

        </section>



        <!-- =========================================
             FEATURES
        ========================================== -->

        <section class="section" id="features">

            <div class="section-heading">

                <span class="section-label">
                    VANTA SYSTEM
                </span>

                <h2>
                    أكثر من مجرد موقع
                </h2>

                <p>
                    منظومة تقنية كاملة مصممة لتكبر معك.
                </p>

            </div>


            <div class="feature-grid">

                <article class="feature-card feature-large">

                    <div class="feature-icon">
                        📚
                    </div>

                    <div>
                        <span class="feature-number">01</span>

                        <h3>
                            تعلّم بطريقة مختلفة
                        </h3>

                        <p>
                            دروس، اختبارات، تحديات وLabs
                            مع نظام XP ومستويات وتقدم شخصي.
                        </p>
                    </div>

                </article>


                <article class="feature-card">

                    <div class="feature-icon">
                        🤖
                    </div>

                    <span class="feature-number">02</span>

                    <h3>NOVA</h3>

                    <p>
                        مساعدك الذكي لفهم البرمجة والتقنية
                        والتعلم بطريقة تناسب مستواك.
                    </p>

                </article>


                <article class="feature-card">

                    <div class="feature-icon">
                        🌐
                    </div>

                    <span class="feature-number">03</span>

                    <h3>VANTABOOK</h3>

                    <p>
                        مجتمع VANTA الحقيقي للتواصل
                        والنشر والملفات الشخصية والرسائل.
                    </p>

                </article>


                <article class="feature-card">

                    <div class="feature-icon">
                        🧪
                    </div>

                    <span class="feature-number">04</span>

                    <h3>Cyber Labs</h3>

                    <p>
                        مختبرات وتحديات عملية لتطوير
                        مهاراتك التقنية والأمنية بشكل آمن.
                    </p>

                </article>


                <article class="feature-card">

                    <div class="feature-icon">
                        🏆
                    </div>

                    <span class="feature-number">05</span>

                    <h3>XP & Achievements</h3>

                    <p>
                        كل تقدم تحققه يتحول إلى XP
                        ومستويات وإنجازات حقيقية.
                    </p>

                </article>

            </div>

        </section>



        <!-- =========================================
             VANTABOOK PREVIEW
        ========================================== -->

        <section class="section vantabook-section" id="vantabook">

            <div class="book-preview">

                <div class="book-preview-top">

                    <div>
                        <span class="section-label">
                            SOCIAL WORLD
                        </span>

                        <h2>
                            VANTABOOK
                        </h2>

                        <p>
                            مجتمع VANTA الذي يجمع المستخدمين
                            في مكان واحد.
                        </p>
                    </div>


                    <div class="book-symbol">
                        V
                    </div>

                </div>


                <div class="fake-feed">

                    <div class="fake-profile">

                        <div class="avatar-placeholder">
                            A
                        </div>

                        <div>
                            <strong>Ali Yaser</strong>
                            <small>Level 8 · الآن</small>
                        </div>

                    </div>


                    <p class="fake-post">
                        أهلاً بكم في الجيل الجديد من VANTA.
                        🚀
                    </p>


                    <div class="fake-actions">

                        <span>♡ 24</span>
                        <span>💬 8</span>
                        <span>↗ مشاركة</span>

                    </div>

                </div>

            </div>

        </section>



        <!-- =========================================
             NOVA
        ========================================== -->

        <section class="section nova-section" id="nova">

            <div class="nova-card">

                <div class="nova-orb">
                    ✦
                </div>

                <div>

                    <span class="section-label">
                        YOUR AI COMPANION
                    </span>

                    <h2>
                        تعرّف على NOVA
                    </h2>

                    <p>
                        ذكاء اصطناعي داخل VANTA يساعدك
                        على التعلم، التفكير، البرمجة وفهم
                        الأشياء المعقدة بطريقة أبسط.
                    </p>

                    <button
                        type="button"
                        class="primary-button"
                        id="openNovaButton"
                    >
                        اكتشف NOVA
                    </button>

                </div>

            </div>

        </section>



        <!-- =========================================
             ABOUT / THANK YOU
        ========================================== -->

        <section class="section about-section">

            <div class="about-card">

                <span class="section-label">
                    THE STORY
                </span>

                <h2>
                    VANTA صُنع بشغف
                </h2>

                <p>
                    تم تطوير VANTA بواسطة
                    <strong>علي ياسر</strong>
                    بهدف بناء مساحة عربية تجمع
                    التقنية والتعلم والذكاء الاصطناعي والمجتمع.
                </p>

                <p class="thanks">

                    شكر خاص لـ
                    <strong>محمد سامي</strong>
                    و
                    <strong>فيصل راني</strong>
                    على الدعم والمساندة. ❤️

                </p>

            </div>

        </section>

    </main>



    <!-- =========================================
         AUTH MODAL
    ========================================== -->

    <div
        class="modal-overlay"
        id="authModal"
        aria-hidden="true"
    >

        <div
            class="auth-modal"
            role="dialog"
            aria-modal="true"
        >

            <button
                type="button"
                class="modal-close"
                id="closeAuthModal"
                aria-label="إغلاق"
            >
                ×
            </button>


            <div class="auth-brand">

                <div class="auth-logo">
                    V
                </div>

                <div>
                    <strong>VANTA</strong>
                    <span>أهلاً بك في عالمك</span>
                </div>

            </div>


            <!-- LOGIN -->

            <div
                class="auth-view active"
                id="loginView"
            >

                <span class="auth-label">
                    أهلاً بعودتك
                </span>

                <h2>
                    تسجيل الدخول
                </h2>

                <p>
                    ارجع إلى رحلتك في VANTA.
                </p>


                <form id="loginForm">

                    <label>
                        البريد الإلكتروني

                        <input
                            type="email"
                            id="loginEmail"
                            autocomplete="email"
                            placeholder="example@email.com"
                            required
                        >

                    </label>


                    <label>
                        كلمة المرور

                        <input
                            type="password"
                            id="loginPassword"
                            autocomplete="current-password"
                            placeholder="••••••••"
                            required
                        >

                    </label>


                    <button
                        type="submit"
                        class="auth-submit"
                    >
                        دخول
                    </button>

                </form>


                <button
                    type="button"
                    class="switch-auth"
                    id="showSignup"
                >
                    ليس لديك حساب؟ <strong>إنشاء حساب</strong>
                </button>

            </div>



            <!-- SIGNUP -->

            <div
                class="auth-view"
                id="signupView"
            >

                <span class="auth-label">
                    بداية جديدة
                </span>

                <h2>
                    أنشئ حسابك
                </h2>

                <p>
                    ادخل عالم VANTA وابدأ رحلتك.
                </p>


                <form id="signupForm">

                    <label>
                        اسم المستخدم

                        <input
                            type="text"
                            id="signupUsername"
                            autocomplete="username"
                            placeholder="اسمك في VANTA"
                            minlength="3"
                            maxlength="30"
                            required
                        >

                    </label>


                    <label>
                        البريد الإلكتروني

                        <input
                            type="email"
                            id="signupEmail"
                            autocomplete="email"
                            placeholder="example@email.com"
                            required
                        >

                    </label>


                    <label>
                        كلمة المرور

                        <input
                            type="password"
                            id="signupPassword"
                            autocomplete="new-password"
                            placeholder="6 أحرف أو أكثر"
                            minlength="6"
                            required
                        >

                    </label>


                    <label class="terms-label">

                        <input
                            type="checkbox"
                            id="termsCheckbox"
                            required
                        >

                        <span>
                            أوافق على شروط الاستخدام وسياسة الخصوصية.
                        </span>

                    </label>


                    <button
                        type="submit"
                        class="auth-submit"
                    >
                        إنشاء حساب
                    </button>

                </form>


                <button
                    type="button"
                    class="switch-auth"
                    id="showLogin"
                >
                    لديك حساب بالفعل؟ <strong>تسجيل الدخول</strong>
                </button>

            </div>


            <!-- STATUS -->

            <div
                class="auth-status"
                id="authStatus"
                role="status"
                aria-live="polite"
            ></div>

        </div>

    </div>



    <!-- =========================================
         FOOTER
    ========================================== -->

    <footer class="footer">

        <div class="footer-brand">

            <strong>VANTA</strong>

            <span>
                عالمك التقني.
            </span>

        </div>


        <div class="footer-links">

            <a href="about.html">
                عن VANTA
            </a>

            <a href="contact.html">
                تواصل معنا
            </a>

            <a href="terms.html">
                الشروط
            </a>

            <a href="privacy.html">
                الخصوصية
            </a>

        </div>


        <div class="copyright">

            © 2026 VANTA — Ali Yaser

        </div>

    </footer>



    <!-- =========================================
         JAVASCRIPT
    ========================================== -->

    <script src="supabase-config.js"></script>
    <script src="app.js"></script>

    <script>

        document.addEventListener("DOMContentLoaded", () => {

            const modal = document.getElementById("authModal");

            const loginView = document.getElementById("loginView");
            const signupView = document.getElementById("signupView");

            const openButtons = [
                document.getElementById("openLoginTop"),
                document.getElementById("openSignupTop"),
                document.getElementById("openSignupHero")
            ];

            const closeButton =
                document.getElementById("closeAuthModal");

            const showSignup =
                document.getElementById("showSignup");

            const showLogin =
                document.getElementById("showLogin");


            function openAuth(mode = "login") {

                modal.classList.add("show");
                modal.setAttribute("aria-hidden", "false");

                if (mode === "signup") {

                    loginView.classList.remove("active");
                    signupView.classList.add("active");

                } else {

                    signupView.classList.remove("active");
                    loginView.classList.add("active");

                }

                document.body.classList.add("modal-open");
            }


            function closeAuth() {

                modal.classList.remove("show");
                modal.setAttribute("aria-hidden", "true");

                document.body.classList.remove("modal-open");
            }


            openButtons.forEach(button => {

                if (!button) return;

                button.addEventListener("click", () => {

                    const signup =
                        button.id !== "openLoginTop";

                    openAuth(signup ? "signup" : "login");

                });

            });


            closeButton?.addEventListener(
                "click",
                closeAuth
            );


            modal?.addEventListener("click", event => {

                if (event.target === modal) {
                    closeAuth();
                }

            });


            showSignup?.addEventListener("click", () => {
                openAuth("signup");
            });


            showLogin?.addEventListener("click", () => {
                openAuth("login");
            });


            document.addEventListener("keydown", event => {

                if (event.key === "Escape") {
                    closeAuth();
                }

            });


            document
                .getElementById("exploreButton")
                ?.addEventListener("click", () => {

                    document
                        .getElementById("features")
                        ?.scrollIntoView({
                            behavior: "smooth"
                        });

                });


            document
                .getElementById("openNovaButton")
                ?.addEventListener("click", () => {

                    window.location.href = "assistant.html";

                });


        });

    </script>

</body>
</html>
