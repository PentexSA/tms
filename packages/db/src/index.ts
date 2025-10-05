import type { Selectable, Insertable, Updateable } from "kysely";
import type { Todos } from "./types";

export { db } from "./client";
export type { DB } from "./types";

export type Todo = Selectable<Todos>;
export type NewTodo = Insertable<Todos>;
export type TodoUpdate = Updateable<Todos>;
