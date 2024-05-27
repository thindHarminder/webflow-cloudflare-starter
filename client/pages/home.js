import {
    Render,
    SortableTable,
    DataStore
} from "thind-js"
import Sortable from 'sortablejs';
import {
    formatDistance, formatISO,
    set
} from "date-fns";
import { initPaymentsDialog } from "../utils/payments";

// All Webflow components
const todoListEl = thind.element.get("todo_list");
const todoActionMenu = thind.element.get("todo_action_menu");
const todoTemplate = thind.element.get("todo_item");
const newTodoButton = thind.element.get("new_todo");
const dummyTodos = thind.element.get("dummy_todos_create");
const todoFormDialog = thind.element.get("todo_form_dialog");
const todoForm = thind.element.get("todo_form");
const pageDataStore = new DataStore({
    todos: {}
}, {
    caching: true
});
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

let todoActionTemplate;
if (todoActionMenu) {
    todoActionTemplate = todoActionMenu.cloneNode(true);
    todoActionMenu.remove();
}

new SortableTable(
    '[thind=table_header]',
    '[thind=todo_list]',
    'data-sort-key', {
        showIndicators: true
    });

Sortable.create(todoListEl, {
    handle: '.handle',
    sort: true,
    animation: 150,
    easing: "cubic-bezier(1, 0, 0, 1)",
    dragClass: "sortable-drag",
    onEnd: function (evt) {
        sortTodos(evt.item.getAttribute("data-todo-id"), evt.newIndex, evt.oldIndex);
    }
});


const todosList = new Render({
    element: todoTemplate,
    dataStore: pageDataStore,
    key: "todos",
    prop: "thind",
    hideEmptyParent: true,
    clearOnUpdate: true,
    emptyState: thind.element.get("todos_empty_state"),
    config: {
        action: (itemData, newElement) => {
            const tableHEader = thind.element.get("table_header");
            if (tableHEader && !itemData) {
                tableHEader.classList.add("hide");
            } else if (tableHEader) {
                tableHEader.classList.remove("hide");
            }
        },
        props: {
            checkbox: {
                dataKey: "completed",
                action:  (value, element, itemData) => {
                    if (value === true) {
                        element.checked = true;
                        markCompleted(element.closest("[thind=todo_item]"));
                    } else {
                        element.checked = false;
                    }
                    element.addEventListener("change",  (event) => {
                         statusToggle(itemData.id, event);
                    });
                }
            },
            todo_title: {
                dataKey: "title",
                action: (value, element) => {
                    element.textContent = value;
                }
            },
            todo_description: {
                dataKey: "description",
                action: (value, element) => {
                    element.textContent = value;
                }
            },
            due_date: {
                dataKey: "due_date",
                action: (value, element) => {
                    const date = formatDistance(new Date(1000 * value), new Date(), {
                        addSuffix: true
                    })
                    element.textContent = date;
                    const isPast = new Date(1000 * value) < new Date();
                    if (isPast) {
                        element.classList.add("text-color-red");
                    }
                }
            },
            created_date: {
                dataKey: "created_at",
                action: (value, element) => {
                    const date = formatDistance(new Date(1000 * value), new Date(), {
                        addSuffix: true
                    })
                    element.textContent = date;
                }
            },
            due_date_unix: {
                dataKey: "due_date",
                action: (value, element) => {
                    element.textContent = value;
                }
            },
            created_date_unix: {
                dataKey: "created_at",
                action: (value, element) => {
                    element.textContent = value;
                }
            },
        },
        after: (itemData, newElement) => {
            const actionButton = thind.element.get("todo_menu_open", newElement);
            newElement.setAttribute("data-todo-id", itemData.id);
            actionButton.addEventListener("click", (event) => {
                todoActionMenuShow(event.target, itemData.id);
            });
        }

    }
})

async function statusToggle(id, event) {
    const status = event.target.checked;
    const parentToDo = event.target.closest("[thind=todo_item]");

    if (status === true) {
        markCompleted(parentToDo);
    } else {
        markUnCompleted(parentToDo);
    }
    updateStausOnServer( id, status, parentToDo);
}

async function updateStausOnServer(id, status, parentToDo){
    const todo = await updateTodo(id, {completed: status});
    if (!todo ) {
        showToast("Failed to update todo status", "error");
        if (status === true) {
            markUnCompleted(parentToDo);
        } else {
            markCompleted(parentToDo);
        }
    } else if (todo && todo.completed !== status){
        showToast("Failed to update todo status", "error");
        if (status === true) {
            markUnCompleted(parentToDo);
        } else {
            markCompleted(parentToDo);
        }
    
    }
    pageDataStore.update(`todos.${todo.index}`, todo);
}

function markCompleted(parentToDo) {
    const title = thind.element.get("todo_title", parentToDo);
    title.style.textDecoration = "line-through";
    const description = thind.element.get("todo_description", parentToDo);
    description.style.textDecoration = "line-through";
    const checkbox = thind.element.get("checkbox", parentToDo);
    checkbox.checked = true;
}
function markUnCompleted(parentToDo) {
    const title = thind.element.get("todo_title", parentToDo);
    title.style.textDecoration = "none";
    const description = thind.element.get("todo_description", parentToDo);
    description.style.textDecoration = "none";
    const checkbox = thind.element.get("checkbox", parentToDo);
    checkbox.checked = false;
}


async function fetchTodos() {
    await fetch(`${import.meta.env.VITE_SERVER_BASE_URL}/todos`)
        .then(response => response.json())
        .then(response => {
            if (response.success === true) {
                const sortedTodos = response.todos.sort((a, b) => a.index - b.index);
                pageDataStore.update("todos", sortedTodos);
            }
        })
        .catch(error => {
            console.log(error);
        });
}


fetchTodos();




dummyTodos.addEventListener("click", (event) => {
    // Post request to create dummy todos
    fetch(`${import.meta.env.VITE_SERVER_BASE_URL}/todos/dummy`, {
        method: "POST"
    })
    .then(response => response.json())
    .then(response => {
        if (response.success === true) {
            pageDataStore.update("todos", response.todos);
        } else {
            showToast("Failed to create dummy todos", "error");
        }
    }) 
    .catch(error => {
        console.log(error);
        showToast("Failed to create dummy todos", "error");
    });
});



newTodoButton.addEventListener("click", (event) => {
    showTodoDialog();
});

async function createNewTodo(data) {
    await fetch(`${import.meta.env.VITE_SERVER_BASE_URL}/todos`, {
            method: "POST",
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        })
        .then(response => response.json())
        .then(response => {
            if (response.success === true) {
                console.log(response.todo);
                pageDataStore.add("todos", response.todo);
                console.log(pageDataStore.get("todos"));
            } else if (response.maxTodoLimit) {
                showToast(response.errorMessage, "error");
                datastore.update("maxTodoLimit", true);
            } else if (response.errorMessage) {
                showToast(response.errorMessage, "error");
            } else {
                showToast("Failed to create new todo", "error");
            }
        })
        .catch(error => {
            console.log(error);
            showToast("Failed to create new todo", "error");

        });
}



function sortTodos(id, newIndex, oldIndex) {
    const todosList = pageDataStore.get("todos");
    const movedTodo = todosList.find((todo) => todo.id == id);
    todosList.splice(oldIndex, 1);
    todosList.splice(newIndex, 0, movedTodo);
    todosList.forEach((todo, index) => {
        todo.index = index;
    });
    pageDataStore.update("todos", todosList);
    const data = todosList.map((todo) => {
        return {
            id: todo.id,
            index: todo.index
        }
    });
    bulkUpdateTodos(data);

}





// update todo index on server
async function updateTodo (id, data) {
    try {
        const response = await fetch(`${import.meta.env.VITE_SERVER_BASE_URL}/todos/${id}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();
        
        if (response.ok && result) {
            return result.todo;
        } else {
            showToast("Failed to update todo index", "error");
            return null;
        }
    } catch (error) {
        console.log(error);
        showToast("Failed to update todo index", "error");
        return null;
    }
}


//Bulk update todos
async function bulkUpdateTodos(data) {
    await fetch(`${import.meta.env.VITE_SERVER_BASE_URL}/todos/bulk`, {
            method: "PATCH",
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        })
        .then(response => response.json())
        .then(response => {
            if (response.success === true) {
                pageDataStore.update("todos", response.todos);
            } else {
                showToast("Failed to update todos", "error");
            }
        })
        .catch(error => {
            console.log(error);
            showToast("Failed to update todos", "error");
        });
}

//Delete todo
async function deleteTodo (id) {
    try {
        const response = await fetch(`${import.meta.env.VITE_SERVER_BASE_URL}/todos/${id}`, {
            method: 'DELETE'
        });

        const result = await response.json();
        
        if (response.ok && result) {
           const todo = pageDataStore.get("todos").find((todo) => todo.id == id);
           const indexInStore = pageDataStore.get("todos").indexOf(todo);
           pageDataStore.delete(`todos.${indexInStore}`);
        } else {
            showToast("Failed to delete todo", "error");
      
        }
    } catch (error) {
        console.log(error);
        showToast("Failed to delete todo", "error");
       
    }
}

//Todo Form

//Diable form submit
thind.form.disable(todoForm)

function todoActionMenuShow(toggleElement, todoId) {
    const exsisitingMenu = thind.element.get("todo_action_menu");
    if (exsisitingMenu) {
        exsisitingMenu.remove();
    }
    const menu = todoActionTemplate.cloneNode(true);
    const menuWrapper = toggleElement.closest("[thind=menu_toggle_wrapper]");
    menuWrapper.appendChild(menu);

    const editButton = thind.element.get("todo_edit", menu);
    if (editButton) {
        editButton.addEventListener("click", (event) => {
            showTodoDialog(todoId);
        });
    }

    const deleteButton = thind.element.get("todo_delete", menu);
    if (deleteButton) {
        deleteButton.addEventListener("click", (event) => {
            deleteTodo(todoId);
        });
    }
    

    function handleClickOutside(event) {
        const nearestMenu = event.target.closest("[thind=todo_action_menu]");
        const iscurrentMenu = nearestMenu === menu;
        if (!iscurrentMenu) {
            menu.remove();
            document.removeEventListener('click', handleClickOutside);
        }
    }

    setTimeout(() => {
        document.addEventListener('click', handleClickOutside);
    }, 100);

}

function showTodoDialog(todoID){
    if (todoID ) {
        const todo = pageDataStore.get("todos").find((todo) => todo.id == todoID);
        if (todo) {
            thind.element.get("todo_title_input", todoForm).value = todo.title;
            thind.element.get("todo_description_input", todoForm).value = todo.description;
            let timestamp = formatISO(new Date(todo.due_date * 1000))
            timestamp = timestamp.slice(0, 16);
            thind.element.get("due_date_input", todoForm).value = timestamp;
            pageDataStore.update("todoFormAction", todo.id);
            thind.form.changeSubmitButton(todoForm, 'Save', false);
        } else {
            showToast("Failed to get todo", "error");
        }
    } else {
        thind.element.get("todo_title_input", todoForm).value = "New Todo Task Title";
        thind.element.get("todo_description_input", todoForm).value = "";
        let timestamp = formatISO(Date.now() + 86400000)
        timestamp = timestamp.slice(0, 16);
        thind.element.get("due_date_input", todoForm).value = timestamp; 
        pageDataStore.update("todoFormAction", "new");
        thind.form.changeSubmitButton(todoForm, 'Create Todo', false);
    }

    todoFormDialog.showModal();
}

todoForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const title = thind.element.get("todo_title_input", todoForm).value;
    const description = thind.element.get("todo_description_input", todoForm).value;
    let due_date = thind.element.get("due_date_input", todoForm).value 
    due_date = Math.floor(new Date(due_date).getTime() / 1000);
    const data = {
        title,
        description,
        due_date,
        completed: false
    }
    if (pageDataStore.get("todoFormAction") === "new") {
        createNewTodo(data);
        todoFormDialog.close();
    } else {
        const todoID = pageDataStore.get("todoFormAction");
        const todo = pageDataStore.get("todos").find((todo) => todo.id == todoID);
        if (todo) {
            const updatedTodo = {
                ...todo,
                title,
                description,
                due_date
            }
            const updated = await updateTodo(todoID, updatedTodo);
            if (updated) {
                pageDataStore.update(`todos.${updated.index}`, updated);
                todoFormDialog.close();
            } else {
                showToast("Failed to update todo", "error");
            }
        } else {
            showToast("Failed to update todo", "error");
        }
    }
});

pageDataStore.subscribe("todos", (data) => {
    if (data.length >= dataStore.get("user.limit")) {
        newTodoButton.classList.add("is-secondary");
        newTodoButton.style.pointerEvents = "none";
        newTodoButton.setAttribute("default-state", newTodoButton.innerHTML)
        //wait for 200ms before showing upsell
        setTimeout(() => {
            dataStore.update("reachedMaxTodo", true);
        newTodoButton.innerHTML = "Upgrade to create more todo";
        }, 200);
    } else {
        newTodoButton.classList.remove("is-secondary");
        newTodoButton.style.pointerEvents = "auto";
        if (newTodoButton.hasAttribute("default-state")) {
            newTodoButton.innerHTML = newTodoButton.getAttribute("default-state");
        } 
        dataStore.update("reachedMaxTodo", false);
    }
});
