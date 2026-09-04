document.addEventListener("DOMContentLoaded", () => {

    console.log("VANTA System Online");

    /* =========================
       VANTA NOTIFICATION
    ========================= */

    function notify(message) {
        const box = document.createElement("div");

        box.textContent = message;

        box.style.position = "fixed";
        box.style.bottom = "25px";
        box.style.right = "25px";
        box.style.padding = "15px 20px";
        box.style.background = "#0d141d";
        box.style.color = "#00ff9d";
        box.style.border = "1px solid rgba(0,255,157,.4)";
        box.style.borderRadius = "10px";
        box.style.zIndex = "9999";
        box.style.boxShadow = "0 0 25px rgba(0,255,157,.15)";

        document.body.appendChild(box);

        setTimeout(() => {
            box.remove();
        }, 3000);
    }


    /* =========================
       BUTTON EFFECTS
    ========================= */

    document.querySelectorAll("button").forEach(button => {

        button.addEventListener("click", () => {

            button.style.transform = "scale(.97)";

            setTimeout(() => {
                button.style.transform = "";
            }, 100);

        });

    });


    /* =========================
       QUIZ SYSTEM
    ========================= */

    const quizCards = document.querySelectorAll(".quiz-card");

    const answers = [
        "Translate domain names into IP addresses",
        "443",
        "Representing data with a fixed-length digest",
        "A social engineering technique used to trick users"
    ];

    let score = 0;

    quizCards.forEach((card, index) => {

        const buttons = card.querySelectorAll(".quiz-options button");

        buttons.forEach(button => {

            button.addEventListener("click", () => {

                buttons.forEach(btn => {
                    btn.disabled = true;
                });

                if (button.textContent.trim() === answers[index]) {

                    score += 100;

                    button.style.borderColor = "#00ff9d";

                    notify("Correct! +100 XP");

                } else {

                    button.style.borderColor = "#ff465d";

                    notify("Incorrect");

                }

            });

        });

    });


    /* =========================
       REVIEW SYSTEM
    ========================= */

    const reviewButton = document.getElementById("submitReview");

    if (reviewButton) {

        reviewButton.addEventListener("click", () => {

            const reviewText =
                document.getElementById("reviewText");

            if (!reviewText ||
                reviewText.value.trim() === "") {

                notify("Please write your feedback first.");

                return;
            }

            notify("Thank you for your feedback.");

            reviewText.value = "";

        });

    }


    /* =========================
       FEEDBACK SYSTEM
    ========================= */

    const feedbackForm =
        document.getElementById("feedbackForm");

    if (feedbackForm) {

        feedbackForm.addEventListener("submit", event => {

            event.preventDefault();

            const message =
                document.getElementById("feedbackMessage");

            if (!message ||
                message.value.trim() === "") {

                notify("Please enter your feedback.");

                return;
            }

            notify("Feedback submitted successfully.");

            feedbackForm.reset();

        });

    }


    /* =========================
       PAGE INTRO
    ========================= */

    const hero = document.querySelector(".page-hero");

    if (hero) {

        hero.style.opacity = "0";
        hero.style.transform = "translateY(15px)";

        setTimeout(() => {

            hero.style.transition =
                "opacity .7s ease, transform .7s ease";

            hero.style.opacity = "1";
            hero.style.transform = "translateY(0)";

        }, 100);

    }


    /* =========================
       VANTA CONSOLE MESSAGE
    ========================= */

    console.log(
        "%cVANTA",
        "color:#00ff9d;font-size:30px;font-weight:bold;"
    );

    console.log(
        "Cybersecurity • Education • Research"
    );

});
