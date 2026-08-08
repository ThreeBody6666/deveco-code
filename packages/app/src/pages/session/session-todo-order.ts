import type { Todo } from "@opencode-ai/sdk/v2"

// The server defines task order. A status change must not move a task in the UI.
export function displayTodoOrder(todos: Todo[]) {
  return todos
}
