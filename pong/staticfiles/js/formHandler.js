const attachFormSubmitHandler = () => {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLoginSub);
    } else {
    }

	const signupForm = document.getElementById('signupForm');
    if (signupForm) {
        signupForm.addEventListener('submit', handleSignupSub);
    } else {
    }

    const passres = document.getElementById('passRes');
    if (passres) {
        passres.addEventListener('submit', handlePasswordReset);
    } else {
    }
    // const newpass = document.getElementById('newPassForm');
    // if ()
};