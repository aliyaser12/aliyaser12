(() => {
    "use strict";

    const getClient = () => {
        return window.VANTA_SUPABASE || null;
    };

    /* =====================================================
       LEVEL SYSTEM
    ===================================================== */

    function calculateLevel(xp = 0) {
        xp = Math.max(0, Number(xp) || 0);

        return Math.floor(
            Math.sqrt(xp / 100)
        ) + 1;
    }


    function xpForLevel(level) {
        level = Math.max(1, Number(level) || 1);

        return Math.pow(level - 1, 2) * 100;
    }


    function xpForNextLevel(level) {
        return Math.pow(level, 2) * 100;
    }


    function getLevelInfo(xp = 0) {

        xp = Math.max(0, Number(xp) || 0);

        const level =
            calculateLevel(xp);

        const currentLevelXP =
            xpForLevel(level);

        const nextLevelXP =
            xpForNextLevel(level);

        const progressXP =
            xp - currentLevelXP;

        const requiredXP =
            nextLevelXP - currentLevelXP;

        const progress =
            requiredXP > 0
                ? Math.min(
                    100,
                    Math.max(
                        0,
                        (progressXP / requiredXP) * 100
                    )
                )
                : 100;

        return {
            level,
            xp,
            currentLevelXP,
            nextLevelXP,
            progressXP,
            requiredXP,
            progress
        };
    }


    /* =====================================================
       GET USER DATA
    ===================================================== */

    async function getXPData() {

        const supabase =
            getClient();

        if (!supabase) {
            throw new Error(
                "Supabase غير متصل."
            );
        }

        const {
            data: {
                user
            },
            error: userError
        } =
            await supabase.auth.getUser();

        if (
            userError ||
            !user
        ) {
            return null;
        }


        const {
            data,
            error
        } =
            await supabase
                .from("profiles")
                .select(`
                    id,
                    username,
                    avatar_url,
                    xp,
                    level,
                    achievements_count,
                    lessons_completed,
                    quizzes_completed,
                    labs_completed,
                    challenges_completed
                `)
                .eq("id", user.id)
                .maybeSingle();


        if (error) {

            console.error(
                "VANTA XP read error:",
                error
            );

            throw error;
        }


        if (!data) {

            return {
                id: user.id,
                username:
                    user.user_metadata?.username ||
                    "VANTA User",
                xp: 0,
                level: 1,
                achievements_count: 0,
                lessons_completed: 0,
                quizzes_completed: 0,
                labs_completed: 0,
                challenges_completed: 0
            };
        }


        const info =
            getLevelInfo(
                data.xp || 0
            );


        return {
            ...data,
            level: info.level
        };
    }


    /* =====================================================
       ADD XP
    ===================================================== */

    async function addXP(
        amount,
        reason = "activity"
    ) {

        amount =
            Number(amount) || 0;

        if (amount <= 0) {
            return null;
        }


        const supabase =
            getClient();

        if (!supabase) {
            throw new Error(
                "Supabase غير متصل."
            );
        }


        const {
            data: {
                user
            },
            error: userError
        } =
            await supabase.auth.getUser();


        if (
            userError ||
            !user
        ) {

            throw new Error(
                "يجب تسجيل الدخول أولًا."
            );
        }


        /*
         * RPC is used so XP changes happen
         * inside the database rather than
         * trusting the browser.
         */

        const {
            data,
            error
        } =
            await supabase.rpc(
                "add_user_xp",
                {
                    p_user_id:
                        user.id,

                    p_amount:
                        amount
                }
            );


        if (error) {

            console.error(
                "VANTA XP update error:",
                error
            );

            throw error;
        }


        console.log(
            `VANTA XP +${amount}`,
            reason
        );


        return data;
    }


    /* =====================================================
       REWARDS
    ===================================================== */

    async function rewardCorrectAnswer() {

        return addXP(
            10,
            "correct_answer"
        );
    }


    async function rewardLessonCompleted() {

        return addXP(
            50,
            "lesson_completed"
        );
    }


    async function rewardQuizCompleted() {

        return addXP(
            100,
            "quiz_completed"
        );
    }


    async function rewardLabCompleted() {

        return addXP(
            75,
            "lab_completed"
        );
    }


    async function rewardChallengeCompleted() {

        return addXP(
            30,
            "challenge_completed"
        );
    }


    /* =====================================================
       PUBLIC API
    ===================================================== */

    window.VANTA_XP = {

        getXPData,

        addXP,

        calculateLevel,

        xpForLevel,

        xpForNextLevel,

        getLevelInfo,

        rewardCorrectAnswer,

        rewardLessonCompleted,

        rewardQuizCompleted,

        rewardLabCompleted,

        rewardChallengeCompleted

    };


    console.log(
        "VANTA XP system initialized."
    );

})();
