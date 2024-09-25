const attachFormSubmitHandler = () => {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
		console.log("Login")
        loginForm.addEventListener('submit', handleLoginSub);
    } else {
        console.log("Login form not found");
    }

	const signupForm = document.getElementById('signupForm');
    if (signupForm) {
		console.log("Signup")
        signupForm.addEventListener('submit', handleSignupSub);
    } else {
        console.log("Signup form not found");
    }

    const passres = document.getElementById('passRes');
    if (passres) {
		console.log("Pass Res")
        passres.addEventListener('submit', handlePasswordReset);
    } else {
        console.log("Pass Reset form not found");
    }
    // const newpass = document.getElementById('newPassForm');
    // if ()
};