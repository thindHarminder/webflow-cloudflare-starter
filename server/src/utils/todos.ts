import {
    dummyTasks
} from "./dummyData";

//drizzle imports
import {
    drizzle
} from 'drizzle-orm/d1';
import * as schema from "../db/schema";
import {
    eq,
    asc,
    desc,
    and
} from "drizzle-orm";
import {getCurrentUser} from "../utils/helper";

export async function geneterateDummytodos(userId: string, d1: D1Database) {
    const db = drizzle(d1, {
        schema: {
            ...schema
        }
    })

    const dummyTasksList = dummyTasks.map((task, index) => {
        return {
            ...task,
            id: (Math.random().toString(36).substring(7)) + userId,
            user_id: userId,
            index: index,
            completed: false,
            created_at: Math.floor(Date.now() / 1000),
            due_date: Math.floor(Date.now() / 1000) + ( (Math.random() * 10000) * (Math.random() < 0.5 ? -1 : 1 ))
        };
    });
    typeof schema.todos;

    try {
       const todos =  await db.insert(schema.todos).values(dummyTasksList).returning({
            id: schema.todos.id,
            title: schema.todos.title,
            description: schema.todos.description,
            due_date: schema.todos.due_date,
            index: schema.todos.index,
            completed: schema.todos.completed,
            created_at: schema.todos.created_at,
        });

        return {
            error: null,
            todos: todos
        };
    } catch (error: any) {
        return {
            error: "An error occurred while generating dummy tasks"
        };
    }


}

export async function getTodos(userId: string, d1: D1Database) {
    const db = drizzle(d1, {
        schema: {
            ...schema.todos
        }
    })

    const todosList = await db.select({
        id: schema.todos.id,
        title: schema.todos.title,
        description: schema.todos.description,
        index: schema.todos.index,
        due_date: schema.todos.due_date,
        completed: schema.todos.completed,
        created_at: schema.todos.created_at,
    }).from(schema.todos).where(eq(schema.todos.user_id, userId)).orderBy(schema.todos.index);

    return todosList;
}

export async function newTodo(userId: string, d1: D1Database, data: typeof schema.todos) {
    const db = drizzle(d1, {
        schema: {
            ...schema.todos
        }
    })

    const lastIndex = await db.select({
        index: schema.todos.index
    }).from(schema.todos).where(eq(schema.todos.user_id, userId)).orderBy(desc(schema.todos.index)).limit(1).execute();
    const index = lastIndex.length === 0 ? 0 : lastIndex[0].index + 1 as number;

    const currentTimestamp = Math.floor(Date.now() / 1000);
    const title = data.title || "New Task";
    const description = data.description || "New Task Description";
    const due_date = data.due_date || currentTimestamp + 86400;
    const todo = [{
        id: (Math.random().toString(36).substring(7)) + userId as string,
        user_id: userId,
        title: title,
        description: description,
        due_date: due_date,
        index,
        completed: false,
        created_at: currentTimestamp
    }];
    typeof schema.todos;


    try {
        const newTodo = await db.insert(schema.todos).values(todo as any).returning({
            id: schema.todos.id,
            title: schema.todos.title,
            description: schema.todos.description,
            due_date: schema.todos.due_date,
            completed: schema.todos.completed,
            created_at: schema.todos.created_at,
        })
        return {
            error: null,
            todo: newTodo
        }
    } catch (error: any) {
        return {
            error: "An error occurred while creating a new task",
            todo: null
        };
    }


}

export async function updateTodo(id: string, d1: D1Database, data: typeof schema.todos) {
    const db = drizzle(d1, {
        schema: {
            ...schema
        }
    })


    try {
        const todo = await db.update(schema.todos).set(data as any).where(eq(schema.todos.id, id)).returning({
            id: schema.todos.id,
            title: schema.todos.title,
            description: schema.todos.description,
            due_date: schema.todos.due_date,
            index: schema.todos.index,
            completed: schema.todos.completed,
            created_at: schema.todos.created_at,
        }).execute();
        return {
            error: null,
            todo: todo[0]
        };
    } catch (error: any) {
        console.log(error);
        return {
            error: error,
            todo: null
        };
    }
}

export async function deleteTodo(id: string, d1: D1Database, user_id: string) {
    const db = drizzle(d1, {
        schema: {
            ...schema.todos
        }
    })

    try {
        await db.delete(schema.todos).where(
			and(eq(schema.todos.id, id), eq(schema.todos.user_id, user_id) ));
        }
    catch (error: any) {
        return {
            error: error,
        };
    }

    const sortAction = await sortIndexes(user_id, d1);
    if (sortAction.error) {
        return {
            error: sortAction.error
        };
    }

    return {
        error: null
    };
}

async function sortIndexes(userId: string, d1: D1Database) {
    const db = drizzle(d1, {
        schema: {
            ...schema.todos
        }
    })

    const todosList = await db.select({
        id: schema.todos.id,
        index: schema.todos.index
    }).from(schema.todos).where(eq(schema.todos.user_id, userId)).orderBy(asc(schema.todos.index)).execute();

    const sortedTodos = todosList.map((todo, index) => {
        return {
            id: todo.id,
            index: index
        };
    }) as any;
    try {
        sortedTodos.forEach(async (todo: any) => {
            await updateTodo(todo.id, d1, todo);
        }
        );
    } catch (error: any) {
        console.log(error);
        return {
            error: error
        };
    }

    return {
        error: null
    };
}

export async function checkTodoLimit(userId: string, d1: D1Database) {
    const db = drizzle(d1, {
        schema: {
            ...schema.todos
        }
    })

    const todos = await getTodos(userId, d1);
    const length = todos.length;
    const user = await getCurrentUser(userId, d1);
    const todoPlan = await db.select({
        todolimit: schema.todoPlans.todolimit
    }).from(schema.todoPlans).where(eq(schema.todoPlans.id, user.todoPlan || "0")).limit(1).execute();
    const limit = todoPlan[0].todolimit || 0;
    return {
        limitReached: length >= limit,
        limit: limit,
    };
}