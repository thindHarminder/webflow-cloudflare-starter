
const loginForm = thind.element.get("login-form");
if (loginForm) {
    thind.form.disable(loginForm);

    loginForm.addEventListener("submit", async function(e){
        e.preventDefault();
        const formData = thind.form.values(loginForm);
        thind.form.errorHide(loginForm);
        thind.form.changeSubmitButton(loginForm, "Logging in...", true);
        // add a pause of 2 seconds
        //post the signup data to backend
        await fetch(`${import.meta.env.VITE_SERVER_BASE_URL}/login`, {
            method: "POST",
            headers: {
            "Content-Type": "application/json"
            },
            body: JSON.stringify(formData)
        })
        .then(response => response.json())
        .then(response => {
            loginFormAction(response);
        })
        .catch(error => {
            thind.form.error(loginForm, "An error occurred. Please try again.");
            console.log(error);
        });

    })
}

function loginFormAction(data){
   if (data.success === false) {
    let message = data.errorMessage || "An error occurred. Please try again."; 
    thind.form.error(loginForm, message);
    thind.form.changeSubmitButton(loginForm, "Try Again", false);
   }
    if (data.success === true) {
        thind.form.success(loginForm, "showMessage", false);
        thind.form.changeSubmitButton(loginForm, "Logged in Successfully", true);
        setTimeout(() => {
            window.location.href = "../app/home";
        }, 2000);
    }
}


