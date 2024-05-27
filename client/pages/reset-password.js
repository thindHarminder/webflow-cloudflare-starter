
const resetForm = thind.element.get("reset-form");

if (resetForm) {
    thind.form.disable(resetForm);

    // get the token from the url
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    
    if (!token) {
        thind.form.error(resetForm, "Invalid Link. This link has expired. Please request a new one.");
    }
    

    resetForm.addEventListener("submit", async function(e){

        e.preventDefault();
        const formData = thind.form.values(resetForm);
        thind.form.errorHide(resetForm);
        thind.form.changeSubmitButton(resetForm, "Saving Password ...", true);
        const body = {...formData, token};
        // add a pause of 2 seconds
        //post the signup data to backend
        await fetch(`${import.meta.env.VITE_SERVER_BASE_URL}/reset-password`, {
            method: "POST",
            headers: {
            "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        })
        .then(response => response.json())
        .then(response => {
            resetFormAction(response);
        })
        .catch(error => {
            thind.form.error(resetForm, "An error occurred. Please try again.");
            console.log(error);
        });

    })
}


const passwordInput = resetForm.querySelector("input[name='password']");
const confirmPasswordInput = resetForm.querySelector("input[name='confirmPassword']");

if (passwordInput && confirmPasswordInput) {
    confirmPasswordInput.addEventListener("input", function(){
        if (passwordInput.value !== confirmPasswordInput.value) {
            thind.form.error(resetForm, "Passwords do not match");
        } else {
            thind.form.errorHide(resetForm);
        }
    })
}

function resetFormAction(data){
   if (data.success === false) {
    let message = data.errorMessage || "An error occurred. Please try again."; 
    thind.form.error(resetForm, message);
    thind.form.changeSubmitButton(resetForm, "Try Again", false);
   }
    if (data.success === true) {
        thind.form.success(resetForm, "showMessage", false);
        thind.form.changeSubmitButton(resetForm, "Password saved", true);
        window.location.href = "/app/home";
    }
}


