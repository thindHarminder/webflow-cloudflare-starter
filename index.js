import { Thind,  Render,  DataStore} from "thind-js";
import Toastify from 'toastify-js';
import { initPaymentsDialog } from "./client/utils/payments";

window.thind = new Thind({attribute : "thind"});

window.dataStore = new DataStore({user: {}, reachedMaxTodo: false}, { caching: true });


async function init(){
  
  async function fetchjs(){
      let name = await thind.page.name();

      const scripts = await document.querySelectorAll("script");
      scripts.forEach(async script => {
        if (script.src.includes(`client/pages/${name}.js`)) {
           console.log("Page specific js file already loaded");
        } else {
          console.log("Loading page specific js file");
          try {
            await import(`./client/pages/${name}.js`);   
          } catch (error) {
            if (error.message.includes("dynamic import")){
              console.log("No page specific js file found");
            }else{
              console.error(error);
            }
          }
        }
      });
  }
  
  fetchjs();
  }
  if(import.meta.env.VITE_SERVER_BASE_URL.includes("dashbaord")){
    init();
  }


//update navbar
const navbar = thind.element.get("navbar");
const userUi = new Render({
    element : navbar,
    dataStore : dataStore,
    key : "user",
    prop: "thind",
    hideEmptyParent: false,
    clearOnUpdate: false,
    config:{
        props:{
          nav_name:{
                dataKey: "first_name",
                action: (value, element) => {
                  thind.skeleton.toggle(element, true);
                    element.textContent = `👋 Hi ${value}`;
                    if (value !== "") {
                      thind.skeleton.toggle(element, false);
                    }
                }
            },
            profile_picture:{
                action: (value, element) => {
                  thind.skeleton.toggle(element, true);
                  if (value) {
                    element.src = value;
                    thind.skeleton.toggle(element, false);
                  }
                }
            },
            auth_button: {
              dataKey: "id",
                action: (value, element) => {
                    if (value) {
                        element.classList.add("hide");
                    } else {
                        element.classList.remove("hide");
                    }
                }
            },
            account_menu : {
              dataKey: "id",
              action: (value, element) => {
                if (value) {
                    element.classList.remove("hide");
                } else {
                    element.classList.add("hide");
                }
            }
            },
            email : {
              action: (value, element) => {
                element.textContent = value;
              }
            },
            first_name : {
              action: (value, element) => {
                element.textContent = value;
              }
            },
            last_name : {
              action: (value, element) => {
                element.textContent = value;
              }
            },

        }
    }
})

// Function to show toast notification
window.showToast = function (message, type) {
  if (Toastify) {
      let style = {
          background: "#433f47",
          border: "1px solid #433f47",
          color: "#ffffff",
      }
      if (type === 'error') {
          style = {
              background: "#f44336",
              border: "1px solid #f44336",
              color: "#ffffff",
          }
      } else if (type === 'success') {
          style = {
              background: "#33b187",
              border: "1px solid #33b187",
              color: "#ffffff",
          }
      }
      // If Toastify is loaded, show the toast
      Toastify({
          text: message,
          duration: 3000,
          close: true,
          gravity: "top",
          position: "right",
          stopOnFocus: true,
          style: {
              ...style,
              fontSize: "0.75rem",
              borderRadius: "1rem",
          }
      }).showToast();
  } else {
      // If Toastify is not loaded, queue the message
      toastQueue.push({
          message,
          type
      });
  }
}

//check if ther eis message parameter in the url
const urlParams = new URLSearchParams(window.location.search);
const message = urlParams.get('message');
if (message) {
  const type = urlParams.get('errorType');
  showToast(message, type);
  //remove the message from the url without reloading the page
  window.history.pushState({}, document.title, window.location.pathname);
}





  async function loadUser(){
    await fetch(`${import.meta.env.VITE_SERVER_BASE_URL}/self`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json"
        }
    })
    .then(response => response.json())
    .then(response => {
        dataStore.update("user", response.user);
        dataStore.update("reachedMaxTodo", response.user.reachedMaxTodo);
  
    })
    .catch(error => {
      if (error.status === 401) {
        console.log("User not logged in");
      }else{
        console.log(error);
      }
    });
}

loadUser();

const logoutButtons = thind.element.getAll("logout");
if (logoutButtons) {
    logoutButtons.forEach(logoutButton => {
        logoutButton.addEventListener("click", async function(e){
            e.preventDefault();
            await fetch(`${import.meta.env.VITE_SERVER_BASE_URL}/logout`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                }
            })
            .then(response => response.json())
            .then(response => {
                logoutAction(response);
            })
            .catch(error => {
                console.log(error);
            });
        })
    });
}

function logoutAction(data){
    if (data.success === true) {
      //refresh the page
      window.location.reload();
    }
    if (data.success === false) {
        console.log(data.errorMessage);
    }
}
const upsellCard = thind.element.get("upsell_card");
const upsellcloseButton = thind.element.get("upsell_close");

if (upsellCard){
dataStore.subscribe("reachedMaxTodo", (data) => {
  if (data === true) {
      upsellCard.classList.add("show");

  } else {
      upsellCard.classList.remove("show");
  }
});

upsellcloseButton.addEventListener("click", (event) => {
  upsellCard.classList.remove("show");
});
const upsellButton = thind.element.get("upsell_button");
upsellButton.addEventListener("click", async (event) => {
  await initPaymentsDialog(dataStore);
});
}


const popupoCloseButtons = thind.element.getAll("plans_cose");
if (popupoCloseButtons) {
  popupoCloseButtons.forEach(button => {
    button.addEventListener("click", () => {
      const paymentDialog = thind.element.get("payments_dialog");
      const plans_wrapper = thind.element.get("plans_list_wrapper");
      if (paymentDialog) {
        plans_wrapper.classList.remove("show");
        setTimeout(() => {
        paymentDialog.classList.remove("show");
        }, 600);
      }
    });
  });
}

//Show Password Inputs
const showPasswordInputs = thind.element.getAll("showPassword");
if (showPasswordInputs) {
  showPasswordInputs.forEach(showPasswordInput => {
    showPasswordInput.addEventListener("click", () => {
      const passwordInput = showPasswordInput.previousElementSibling;
      if (passwordInput.type === "password") {
        passwordInput.type = "text";
        showPasswordInput.classList.add("is-slash");
      } else {
        passwordInput.type = "password";
        showPasswordInput.classList.remove("is-slash");
      }
    });
  });
}