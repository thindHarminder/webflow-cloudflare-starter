
const recoverForm = thind.element.get("recover-form");
if (recoverForm) {
    thind.form.disable(recoverForm);

    recoverForm.addEventListener("submit", async function(e){
        e.preventDefault();
        const formData = thind.form.values(recoverForm);
        thind.form.errorHide(recoverForm);
        thind.form.changeSubmitButton(recoverForm, "Sendig recovery email ...", true);
        // add a pause of 2 seconds
        //post the signup data to backend
        await fetch(`${import.meta.env.VITE_SERVER_BASE_URL}/recover-password`, {
            method: "POST",
            headers: {
            "Content-Type": "application/json"
            },
            body: JSON.stringify(formData)
        })
        .then(response => response.json())
        .then(response => {
            recoverFormAction(response);
        })
        .catch(error => {
            thind.form.error(recoverForm, "An error occurred. Please try again.");
            console.log(error);
        });

    })
}


function recoverFormAction(data){
   if (data.success === false) {
    let message = data.errorMessage || "An error occurred. Please try again."; 
    thind.form.error(recoverForm, message);
    thind.form.changeSubmitButton(recoverForm, "Try Again", false);
   }
    if (data.success === true) {
        thind.form.success(recoverForm, "showMessage", false);
        thind.form.changeSubmitButton(recoverForm, "Email sent if user exsists", true);
    }
}


