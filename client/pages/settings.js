import { Render } from "thind-js"
import * as FilePond from 'filepond';
import FilePondPluginFileValidateSize from 'filepond-plugin-file-validate-size';
import FilePondPluginFileValidateType from 'filepond-plugin-file-validate-type';
import { initPaymentsDialog } from "../utils/payments";


const settingsWrapper = thind.element.get("settings");


const settingsUi = new Render({
    element : settingsWrapper,
    dataStore : dataStore,
    key : "user",
    prop: "thind",
    hideEmptyParent: false,
    clearOnUpdate: false,
    config:{
        props:{          
           profile_picture:{
          action: (value, element) => {

            thind.skeleton.toggle(element, true);
            if (value) {
              element.src = value;
              thind.skeleton.toggle(element, false);
            }

          }
      },
            email : {
              action: (value, element) => {
                thind.skeleton.toggle(element, true);
                if (value) {
                 element.value = value;
                 thind.skeleton.toggle(element, false);    
            }
              }
            },
            first_name : {
              action: (value, element) => {
                thind.skeleton.toggle(element, true);
                if (value){
                  element.value = value;
                  thind.skeleton.toggle(element, false);
                }
              }
              
            },
            last_name : {
              action: (value, element) => {
                thind.skeleton.toggle(element, true);
                if (value){
                  element.value = value;
                  thind.skeleton.toggle(element, false);
                }
              }
            },
            subscription_manage:{
              dataKey: "stripe_subscription_id",
              action: (value, element) => {
                if (value) {
                  element.innerHTML = 'Manage Subscription';
                  element.setAttribute("data-action", "manage");
                } else {
                  element.innerHTML = 'Upgrade Subscription';
                  element.setAttribute("data-action", "subscribe");
                }
              }
            },
            subscription_plan: {
              dataKey: "todoPlan",
              action: (value, element) => {
                if (value) {
                  fetch (`${import.meta.env.VITE_SERVER_BASE_URL}/plans`, {
                    headers: {
                      "Content-Type": "application/json"
                    }
                  })
                  .then(response => response.json())
                  .then(response => {
                    if (response.plans) {
                      const plans = response.plans;
                      const plan = plans.find(plan => plan.id === value);
                      element.innerHTML = plan.name;
                    } else {
                      element.innerHTML = 'No Plan';
                    }
                  });
              }
            },
            }
          }

        }
    }
);


const inputs = {
  firstName: thind.element.get("first_name"),
  lastName: thind.element.get("last_name"),
  email: thind.element.get("email")
};

// Input event listeners
inputs.firstName.addEventListener("input", updateSettings);
inputs.lastName.addEventListener("input", updateSettings);
inputs.email.addEventListener("input", updateCredentials);

// Save buttons
const saveSettingsButton = thind.element.get("save_user");
const saveCredentialsButton = thind.element.get("credentials_update");

// Dialog Popups and Buttons
//Email Update Dialog
const emailUpdateDialog = thind.element.get("email_save");
//Password Update Dialog
const passwordUpdateDialog = thind.element.get("password_save");
const changePasswordButton  = thind.element.get("change_password");
// Profile Picture Update Dialog
const profilePictureUpdateDialog = thind.element.get("profile_picture_save");
const profilePictureButton = thind.element.get("profile_picture_button");

const profilePictureForm = thind.element.get("profile_picture_form");

// FilePond File Uploader

FilePond.registerPlugin(FilePondPluginFileValidateSize); 
FilePond.setOptions({
  server: {
   process: async (fieldName, file, metadata, load, error, progress, abort, transfer, options) => {
    const type = file.type;
    if (!type.startsWith('image/')) {
      error('Invalid file type. Please upload an image file.');
      thind.form.error(profilePictureForm, 'Invalid file type. Please upload an image file.');
      return;
    }
    
    const formData = new FormData();
    formData.append(fieldName, file, file.name);

    const request = new XMLHttpRequest();
    request.open('POST', `${import.meta.env.VITE_SERVER_BASE_URL}/profile-picture`);

    request.upload.onprogress = (e) => {
      progress(e.lengthComputable, e.loaded, e.total);
  };

  request.onload = function () {
    if (request.status >= 200 && request.status < 300) {
        // the load method accepts either a string (id) or an object
        load(request.responseText);
        const user = JSON.parse(request.responseText).user;
        dataStore.update("user", user);
        // after successful upload, close the dialog and remove the file after 2 seconds
        setTimeout(() => {
        profilePictureUpdateDialog.close();
        dropzone.removeFile();
        }, 2000);
    } else {
        // Can call the error method if something is wrong, should exit after
        error('oh no');
        const errorMessage = JSON.parse(request.responseText).errorMessage;
        thind.form.error(profilePictureForm, errorMessage);
    }
};

request.send(formData);

return {
  abort: () => {
      request.abort();
      abort();
  },
};



  }
} },
);

const dropzone = FilePond.create(
  document.querySelector('#myfile'),  {
    allowFileSizeValidation: true,
    maxFileSize: '1MB',
    labelMaxTotalFileSizeExceeded: 'File is too large. Max filesize: {filesize}.',
    labelIdle: `Drag & Drop your picture or <span class="filepond--label-action">Browse</span>`,
  }, 
);


changePasswordButton.addEventListener("click", () => {
  passwordUpdateDialog.showModal();
} );

profilePictureButton.addEventListener("click", () => {
  profilePictureUpdateDialog.showModal();
});




// Folms inside the dialogs
const emailForm = thind.element.get("email_form");
const passwordForm = thind.element.get("password_form");

if (emailForm) {
  thind.form.disable(emailForm);
  emailForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const body = {
      email: inputs.email.value,
      password: emailForm.password.value
    };
    await updateUser(body, emailForm, saveCredentialsButton);
  });
}

if (passwordForm) {
  thind.form.disable(passwordForm);
  passwordForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const body = {
      password: passwordForm.password.value,
      newPassword : passwordForm.newPassword.value
    };
    await updateUser(body, passwordForm, changePasswordButton);
  });
}



function updateSettings() {
  const firstName = inputs.firstName.value;
  const lastName = inputs.lastName.value;
  const userData = dataStore.get("user");
  const hasChanged = userData.first_name !== firstName || userData.last_name !== lastName;
  saveSettingsButton.classList.toggle("disabled", !hasChanged);
}

function updateCredentials() {
  const email = inputs.email.value;
  const userData = dataStore.get("user");
  const hasChanged = userData.email !== email;
  saveCredentialsButton.classList.toggle("disabled", !hasChanged);
}

saveSettingsButton.addEventListener("click", async () => {
  const userData = {
    first_name: inputs.firstName.value,
    last_name: inputs.lastName.value
  };
  await updateUser(userData, null, saveSettingsButton);
});

saveCredentialsButton.addEventListener("click", () => {
  emailUpdateDialog.showModal();
});



async function updateUser(body, form, saveButton) {
  const response = await fetch(`${import.meta.env.VITE_SERVER_BASE_URL}/user`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  }).catch(() => {
    console.error("Network error: Unable to update user.");
  });

  if (response) {
    const data = await response.json();
    if (data.success) {
      dataStore.update("user", data.user);
      if (form) {
        thind.form.changeSubmitButton(form, "Update Successful", false);
        setTimeout(() => {
          form.closest("dialog")?.close();
          thind.form.reset(form);
        }, 2000);
      }
      saveButton.classList.add("disabled");
    } else {
      thind.form.error(form, data.errorMessage);
      thind.form.changeSubmitButton(form, "Try Again", false);
    }
  }
}

const closeDialogButtons = thind.element.getAll("dialog_close");
if (closeDialogButtons) {
  closeDialogButtons.forEach(button => {
    button.addEventListener("click", () => {
      const parentDialog = button.closest("dialog");
      const form = parentDialog.querySelector("form");
      if (form) {
        thind.form.reset(form);
      }
      parentDialog.close();
    });
  });
}

// Subscription Manage Button
const subscriptionManageButton = thind.element.get("subscription_manage");
subscriptionManageButton.addEventListener("click", async () => {
  const action = subscriptionManageButton.getAttribute("data-action");
  if (action === "subscribe") {
    initPaymentsDialog(dataStore);
  } else {
    openStripePortal();
  }
});

async function openStripePortal(){
  await fetch(`${import.meta.env.VITE_SERVER_BASE_URL}/stripe-portal`, {
    headers: {
      "Content-Type": "application/json"
    }
  })
  .then(response => response.json())
  .then(response => {
    if ( response.url) {
      //open in new tab
      window.open(response.url);
    } else {
      console.log(response.errorMessage);
      showToastr(response.errorMessage, "error");
    }
  });
}