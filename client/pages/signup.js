import { DataStore, Render } from "thind-js";
const signupForm = thind.element.get("signup-form");
if (signupForm) {
    thind.form.disable(signupForm);

    signupForm.addEventListener("submit", async function(e){
        e.preventDefault();
        const formData = thind.form.values(signupForm);
        thind.form.errorHide(signupForm);
        thind.form.changeSubmitButton(signupForm, "Creating Account ...", true);
    
        //post the signup data to backend
        await fetch(`${import.meta.env.VITE_SERVER_BASE_URL}/signup`, {
            method: "POST",
            headers: {
            "Content-Type": "application/json"
            },
            body: JSON.stringify(formData)
        })
        .then(response => response.json())
        .then(response => {
            signupFormAction(response);
        })
        .catch(error => {
            thind.form.error(signupForm, "An error occurred. Please try again.");
            console.log(error);
        });

    })
}

function signupFormAction(data){
   if (data.success === false) {
    let message = data.errorMessage || "An error occurred. Please try again."; 
    thind.form.error(signupForm, message);
    thind.form.changeSubmitButton(signupForm, "Try Again", false);
   }
    if (data.success === true) {
        thind.form.success(signupForm, "showMessage", false);
        thind.form.changeSubmitButton(signupForm, "Account Created", true);
        setTimeout(() => {
            window.location.href = "/app/home";
        

        }, 2000);
    }
}

const SignupRegexList = {
    minimumLength: {
        regex: /.{8,}/,
        message: "Password must be at least 8 characters long"
    },
    hasNumber: {
        regex: /\d/,
        message: "Password must contain at least one number"
    },
    hasLowerCase: {
        regex: /[a-z]/,
        message: "Password must contain at least one lowercase letter"
    },
    hasUpperCase: {
        regex: /[A-Z]/,
        message: "Password must contain at least one uppercase letter"
    },
    hasSymbol: {
        regex: /[^a-zA-Z\d]/,
        message: "Password must contain at least one symbol"
    }
}
const passwordDiv = thind.element.get("password_div");
const errosList = new DataStore({erros: {}})   
const passwordInput = signupForm.querySelector("input[name='password']");
if (passwordInput) {
    passwordInput.addEventListener("input", function(){
        errosList.update("erros", "");
        validatePassword(passwordInput.value);
    })
}

function validatePassword(password){
    let valid = true;
    Object.keys(SignupRegexList).forEach(key => {
        if (!SignupRegexList[key].regex.test(password)) {
            valid = false;
            errosList.add("erros", SignupRegexList[key].message);
        }
    });
}


new Render({
    element: thind.element.get("error_item"),
    dataStore: errosList,
    key: "erros",
    prop: "thind",
    hideEmptyParent: true,
    clearOnUpdate: true,
    config: {
        after: (itemData, element) => {
            element.textContent = itemData;
        }
    }
});

errosList.subscribe("erros", (data) => {
    if (data.length > 0) {
        passwordDiv.classList.remove("hide");
    } else {
        passwordDiv.classList.add("hide");
    }
});
