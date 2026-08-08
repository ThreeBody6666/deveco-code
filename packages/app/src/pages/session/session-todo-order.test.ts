import { describe, expect, test } from "bun:test"
import type { Todo } from "@opencode-ai/sdk/v2"
import { displayTodoOrder } from "./session-todo-order"

const todo = (content: string, status: Todo["status"]): Todo => ({ content, status, priority: "medium" })

describe("displayTodoOrder", () => {
  test("keeps the server order when a task becomes completed", () => {
    const todos = [todo("first", "pending"), todo("second", "completed"), todo("third", "in_progress")]

    expect(displayTodoOrder(todos).map((item) => item.content)).toEqual(["first", "second", "third"])
  })
})
