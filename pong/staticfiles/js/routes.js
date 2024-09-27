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
    console.log("HERERERE");
    let url = window.location.hash;
    let locationEnd = url.indexOf('?') !== -1 ? url.indexOf('?') : url.length;
    let location = url.substring(url.indexOf('#') + 1, locationEnd);
    let queryParams = getQueryParams();

	console.log("query:  ", queryParams);
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

    if (queryParams.error && location == 'login')
    {
        displayVerificationMessage(queryParams);
    }
    const route = routes[location] || routes[404];

    console.log("Location: ", location);
    console.log("Route: " , route);
    try {
        const response = await fetch(route.template);
        if (!response.ok) {
            if (response.status === 404) {
                document.getElementById("content").innerHTML = '<h1>Page Not Found</h1>';
                document.title = '404 Not Found';
            } else {
                throw new Error(`Network response was not ok: ${response.statusText}`);
            }
        }
        else {
            const html = await response.text();
            document.getElementById("content").innerHTML = html;
            document.title = route.title;
            attachFormSubmitHandler(location);

            console.log(queryParams);
            console.log(queryParams.verification);
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
                        check2faStatus();
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
        }
    } catch (error) {
        console.error('Error loading content:', error);
        document.getElementById("content").innerHTML = '<h1>Error loading page</h1>';
        document.title = 'Error';
    }

    function check2faStatus() {
        const toggleBtn = document.getElementById('toggleBtn');
        const extraInputField = document.getElementById('extraInputField');
        const submitExtraInput = document.getElementById('submitExtraInput');

        fetch('/get-2fa-status/', {
            method: 'GET',
            headers: {
                'X-CSRFToken': getCookie('csrftoken'),
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                console.log("FETTTTTTCHHHHHHH");
                if (data.is_enabled) {
                    toggleBtn.classList.remove('disabled');
                    toggleBtn.classList.add('enabled');
                    toggleBtn.textContent = 'Disable';

                } else {
                    toggleBtn.classList.remove('enabled');
                    toggleBtn.classList.add('disabled');
                    toggleBtn.textContent = 'Enable';
                }
            } else {
                console.error('Error fetching 2FA status');
            }
        })
        .catch(error => {
            console.error('Fetch error:', error);
        });
    }
};

const handlePasswordReset = async (event) => {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);

    clearPreviousMessages();

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
            displayMessage('Password reset email sent successfully', 'success');
        } else {
            displayMessage(data.error || 'Password reset failed', 'error');
        }
    } catch (error) {
        console.error('Error submitting form:', error);
        displayMessage('An error occurred. Please try again.', 'error');
    }
};

const handleNewPassRes = (token) => {
    const form = document.getElementById('newPassForm');
    const tokenField = document.getElementById('token');
    tokenField.value = token;

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const formData = new FormData(form);


        clearPreviousMessages();

        const newPassword = formData.get('new_password');
        const confirmPassword = formData.get('confirm_password');
        
        if (newPassword !== confirmPassword) {
            displayMessage('Passwords do not match.');
            return;
        }

        if (newPassword.length < 8) {
            displayMessage('Password must be at least 8 characters long.');
            return;
        }

        const uppercaseRegex = /[A-Z]/;
        const digitRegex = /[0-9]/;
        const symbolRegex = /[!@#$%^&*(),.?":{}|<>]/;

        if (!uppercaseRegex.test(newPassword) || !digitRegex.test(newPassword) || !symbolRegex.test(newPassword)) {
            displayMessage('Password must contain at least one uppercase letter, one digit, and one symbol.');
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
                window.location.href = '#login';
            } else {
                displayMessage(data.error || 'Password reset failed.');
            }
        } catch (error) {
            console.error('Error submitting form:', error);
            displayMessage('An error occurred. Please try again.');
        }
    });
};

const clearPreviousMessages = () => {
    const existingMessageDiv = document.querySelector('.alert');
    if (existingMessageDiv) {
        existingMessageDiv.remove();
    }
};

const displayMessage = (message, type) => {
    clearPreviousMessages();

    const messageDiv = document.createElement('div');
    messageDiv.classList.add('alert', `alert-${type === 'success' ? 'success' : 'danger'}`, 'mt-3');
    messageDiv.textContent = message;

    const form = document.querySelector('form');
    if (form) {
        form.insertAdjacentElement('beforebegin', messageDiv);
    }
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
        console.log("HERE");
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('alert', 'alert-success', 'mt-1');
        messageDiv.style.padding = '8px';
        if (verification === 'success') {
            messageDiv.textContent = 'Your email has been verified. You can now log in.';
        } else {
            messageDiv.textContent = 'The verification link is invalid or has expired.';
            messageDiv.classList.replace('alert-success', 'alert-danger');
        }

        const loginForm = document.querySelector('#loginForm');
        if (loginForm) {
            loginForm.insertAdjacentElement('beforebegin', messageDiv);
        }
    }

    if (queryParams.error) {
            alert(`Error found: ${queryParams.error}`);
        
            console.log("Error found:", queryParams.error);
    }
};


window.addEventListener("hashchange", LocationHandler);
  

window.addEventListener("DOMContentLoaded", () => {
	LocationHandler();
});
  