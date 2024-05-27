
const verifyEmailForm = thind.element.get("verify-form");
if (verifyEmailForm) {
    thind.form.disable(verifyEmailForm);

    verifyEmailForm.addEventListener("submit", async function(e){
        e.preventDefault();
        const formData = thind.form.values(verifyEmailForm);
        console.log(formData);
        thind.form.errorHide(verifyEmailForm);
        thind.form.changeSubmitButton(verifyEmailForm, "Verifying Email ...", true);
        //post the signup data to backend
        await fetch(`${import.meta.env.VITE_SERVER_BASE_URL}/verify-email`, {
            method: "POST",
            headers: {
            "Content-Type": "application/json"
            },
            body: JSON.stringify(formData)
        })
        .then(response => response.json())
        .then(response => {
            verifyEmailFormAction(response);
        })
        .catch(error => {
            thind.form.error(verifyEmailForm, "An error occurred. Please try again.");
            console.log(error);
        });

    })
}

function verifyEmailFormAction(data){
   if (data.success === false) {
    let message = data.errorMessage || "An error occurred. Please try again."; 
    thind.form.error(verifyEmailForm, message);
    thind.form.changeSubmitButton(verifyEmailForm, "Try Again", false);
   }
    if (data.success === true) {
        thind.form.success(verifyEmailForm, "showMessage" , false);
        thind.form.changeSubmitButton(verifyEmailForm, "Email Verified", true);
        setTimeout(() => {
            window.location.href = "/app/home";
        }, 2000);
    }
}


const rendedButton = thind.element.get("resend");
if (rendedButton){
    rendedButton.addEventListener("click", async function(e){
        e.preventDefault();
        await fetch(`${import.meta.env.VITE_SERVER_BASE_URL}/resend-verification`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            }
        })
        .then(response => response.json())
        .then(response => {
            resendAction(response);
        })
        .catch(error => {
            console.log(error);
        });
    })
}



