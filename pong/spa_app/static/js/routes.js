const routes = {
	404: {
	  template: "/static/templates/404.html",
	  title: "404",
	},
	signup: {
	  template: "/static/templates/signup.html",
	  title: "Sing Up",
	},
	passreset: {
	  template: "/static/templates/password_reset.html",
	  title: "Password Reset",
	},
	login: {
	  template: "/static/templates/login.html",
	  title: "Login",
	},
    home: {
        template: "/static/templates/home.html",
        title: "Home",
    },
    setnewpass:{
        template: "/static/templates/set_new_password.html",
        title: "New Pass",
    }
};
  
  
const getQueryParams = () => {
    const params = {};
    let queryString = window.location.search;

    if (window.location.hash.indexOf('?') !== -1) {
        queryString = window.location.hash.substring(window.location.hash.indexOf('?'));
    }

    queryString.replace(/^\?/, '').split('&').forEach(param => {
        const [key, value] = param.split('=');
        params[key] = decodeURIComponent(value);
    });

    console.log(params);
    return params;
};

const isAuthenticated = async () => {
    try {
        const response = await fetch('/api/check-authentication/', {
            method: 'GET',
            'X-CSRFToken': getCookie('csrftoken'),
        });

        if (!response.ok) {
            throw new Error('Failed to fetch authentication status');
        }

        const data = await response.json();
        return data.authenticated;
    } catch (error) {
        console.error('Error checking authentication:', error);
        return false;
    }
};

// Function to handle the location
const LocationHandler = async () => {
    let url = window.location.hash;
    let locationEnd = url.indexOf('?') !== -1 ? url.indexOf('?') : url.length;
    let location = url.substring(url.indexOf('#') + 1, locationEnd);
    let queryParams = getQueryParams();

	console.log(location);
    if (location.length === 0) {
        location = 'login';
    }

    if (location === 'home') {
        const authenticated = await isAuthenticated();
        if (!authenticated) {
            window.location.href = '/';
            alert("User needs to be authenticated. Redirecting to login page.");
            return;
        }
    }

    const route = routes[location] || routes[404];
    try {
        const response = await fetch(route.template);
        if (!response.ok) {
            throw new Error(`Network response was not ok: ${response.statusText}`);
        }
        const html = await response.text();
        document.getElementById("content").innerHTML = html;
        document.title = route.title;
        attachFormSubmitHandler(location);

		console.log(queryParams);
		console.log(queryParams.verification);
        // Display verification message if query parameters are present
        if (queryParams.verification) {
            displayVerificationMessage(queryParams);
        }

        if (location === 'home') {
            console.log("At Home");
            fetchUserData();
            const editProfileBtn = document.getElementById('editProfileBtn');
            console.log("Button");
            console.log(editProfileBtn);
            if (editProfileBtn) {
                editProfileBtn.addEventListener('click', () => {
                    showEditProfileModal();
                    console.log("CLICKED");
                });
            }
            initializeHome(); 
        }

        if (location === 'setnewpass') {
            console.log("HERE");
            console.log(queryParams.token);
            if (queryParams.token) {
                const isValid = await validateToken(queryParams.token);
                if (!isValid) {
                    document.getElementById("content").innerHTML = '<h1>Invalid or expired token</h1>';
                    document.title = 'Error';
                } else {
                    console.log(location);
                    handleNewPassRes(queryParams.token);
                }
            } else {
                document.getElementById("content").innerHTML = '<h1>Token is required to reset password</h1>';
                document.title = 'Error';
            }
        }
    } catch (error) {
        console.error('Error loading content:', error);
        document.getElementById("content").innerHTML = '<h1>Error loading page</h1>';
        document.title = 'Error';
    }
};

const handleNewPassRes = (token) => {
    const form = document.getElementById('newPassForm');
    const tokenField = document.getElementById('token');
    tokenField.value = token;

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const formData = new FormData(form);

        const newPassword = formData.get('new_password');
        const confirmPassword = formData.get('confirm_password');
        
        const errorMessage = document.getElementById('error-message');
        errorMessage.innerText = ''; // Clear previous errors

        if (newPassword !== confirmPassword) {
            errorMessage.innerText = 'Passwords do not match.';
            return;
        }

        if (newPassword.length < 8) {
            errorMessage.innerText = 'Password must be at least 8 characters long.';
            return;
        }

        const uppercaseRegex = /[A-Z]/;
        const digitRegex = /[0-9]/;
        const symbolRegex = /[!@#$%^&*(),.?":{}|<>]/;

        if (!uppercaseRegex.test(newPassword) || !digitRegex.test(newPassword) || !symbolRegex.test(newPassword)) {
            errorMessage.innerText = 'Password must contain at least one uppercase letter, one digit, and one symbol.';
            return;
        }

        formData.append('token', token);
        
        try {
            const response = await fetch('/api/set-new-password/', {
                method: 'POST',
                body: formData,
                headers: {
                    'X-CSRFToken': getCookie('csrftoken'),
                },
            });

            if (!response.ok) {
                throw new Error(`Network response was not ok: ${response.statusText}`);
            }
            const data = await response.json();
            if (data.success) {
                console.log('Password reset successful');
                // Redirect to login or another appropriate page
                window.location.href = '#login';
            } else {
                console.error('Password reset failed', data.error);
                errorMessage.innerText = data.error;
            }
        } catch (error) {
            console.error('Error submitting form:', error);
            errorMessage.innerText = 'An error occurred. Please try again.';
        }
    });
};

const validateToken = async (token) => {
    try {
        const response = await fetch(`/api/validate-token/?token=${token}`);
        if (!response.ok) {
            throw new Error(`Network response was not ok: ${response.statusText}`);
        }
        const data = await response.json();
        return data.valid;
    } catch (error) {
        console.error('Error validating token:', error);
        return false;
    }
};

const displayVerificationMessage = (queryParams) => {
	console.log("HEEEElllloooo");
    const verification = queryParams['verification'];
    if (verification) {
		console.log("HERE")
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('alert', 'alert-success', 'mt-1');
		messageDiv.style.padding = '8px';
        if (verification === 'success') {
            messageDiv.textContent = 'Your email has been verified. You can now log in.';
        } else {
            messageDiv.textContent = 'The verification link is invalid or has expired.';
            messageDiv.classList.replace('alert-success', 'alert-danger');
        }

        const loginForm = document.querySelector('#loginForm'); // Adjust the selector to match your login form
        if (loginForm) {
            loginForm.insertAdjacentElement('beforebegin', messageDiv);
        }
    }
};

const handlePasswordReset = async (event) => {
    console.log("Pass Reset");
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);

    try {
        const response = await fetch(form.action, {
            method: form.method,
            body: formData,
            headers: {
                'X-CSRFToken': getCookie('csrftoken'),
            },
        });

        if (!response.ok) {
            throw new Error(`Network response was not ok: ${response.statusText}`);
        }
        const data = await response.json();
        if (data.success) {
            console.log('Password reset email sent successfully');
        } else {
            console.error('Password reset failed', data.error);
        }
    } catch (error) {
        console.error('Error submitting form:', error);
    }
};

  // Listen to hash changes
window.addEventListener("hashchange", LocationHandler);
  
  // Initial load
window.addEventListener("DOMContentLoaded", () => {
	LocationHandler();
});
  