import { describe, expect, test } from "bun:test"
import { mapDevecoModelConfig } from "@/plugin/deveco-models"

describe("mapDevecoModelConfig", () => {
  test("does not fabricate image input for text-only DevEco models", () => {
    const model = mapDevecoModelConfig({
      id: 1,
      model_id: "ark-code-latest",
      input_modalities: ["text"],
    })

    expect(model.modalities?.input).toEqual(["text"])
    expect(model.attachment).toBe(false)
  })
})
