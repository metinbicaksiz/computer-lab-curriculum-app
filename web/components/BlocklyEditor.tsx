"use client";
// Blockly workspace. Saves its state as JSON (stored as the lesson's "code")
// and reports the JavaScript the blocks turn into.
import * as Blockly from "blockly";
import { javascriptGenerator, Order } from "blockly/javascript";
import { useEffect, useRef } from "react";

// Make "print" write to our output panel instead of popping up an alert.
javascriptGenerator.forBlock["text_print"] = (block, generator) => {
  const msg = generator.valueToCode(block, "TEXT", Order.NONE) || "''";
  return `console.log(${msg});\n`;
};
// Don't inject loop-trap code into the generated JS we show students.
javascriptGenerator.INFINITE_LOOP_TRAP = null;

const toolbox = {
  kind: "categoryToolbox",
  contents: [
    {
      kind: "category", name: "Text", colour: "160",
      contents: [
        { kind: "block", type: "text_print", inputs: { TEXT: { shadow: { type: "text", fields: { TEXT: "Hello" } } } } },
        { kind: "block", type: "text" },
        { kind: "block", type: "text_join" },
        { kind: "block", type: "text_length" },
      ],
    },
    {
      kind: "category", name: "Loops", colour: "120",
      contents: [
        { kind: "block", type: "controls_repeat_ext", inputs: { TIMES: { shadow: { type: "math_number", fields: { NUM: 4 } } } } },
        {
          kind: "block", type: "controls_for",
          inputs: {
            FROM: { shadow: { type: "math_number", fields: { NUM: 1 } } },
            TO: { shadow: { type: "math_number", fields: { NUM: 10 } } },
            BY: { shadow: { type: "math_number", fields: { NUM: 1 } } },
          },
        },
        { kind: "block", type: "controls_whileUntil" },
        { kind: "block", type: "controls_forEach" },
        { kind: "block", type: "controls_flow_statements" },
      ],
    },
    {
      kind: "category", name: "Logic", colour: "210",
      contents: [
        { kind: "block", type: "controls_if" },
        { kind: "block", type: "logic_compare" },
        { kind: "block", type: "logic_operation" },
        { kind: "block", type: "logic_negate" },
        { kind: "block", type: "logic_boolean" },
      ],
    },
    {
      kind: "category", name: "Math", colour: "230",
      contents: [
        { kind: "block", type: "math_number" },
        { kind: "block", type: "math_arithmetic" },
        { kind: "block", type: "math_number_property" },
        { kind: "block", type: "math_modulo" },
        {
          kind: "block", type: "math_random_int",
          inputs: {
            FROM: { shadow: { type: "math_number", fields: { NUM: 1 } } },
            TO: { shadow: { type: "math_number", fields: { NUM: 100 } } },
          },
        },
      ],
    },
    {
      kind: "category", name: "Lists", colour: "260",
      contents: [
        { kind: "block", type: "lists_create_with" },
        { kind: "block", type: "lists_length" },
        { kind: "block", type: "lists_getIndex" },
      ],
    },
    { kind: "sep" },
    { kind: "category", name: "Variables", colour: "330", custom: "VARIABLE" },
    { kind: "category", name: "Functions", colour: "290", custom: "PROCEDURE" },
  ],
};

export default function BlocklyEditor({
  initialState, onChange,
}: {
  initialState: string;
  onChange: (state: string, js: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!host.current) return;
    const ws = Blockly.inject(host.current, {
      toolbox,
      media: "/blockly-media/", // served locally, no internet needed
      trashcan: true,
      zoom: { controls: true, wheel: true, startScale: 1.0 },
      grid: { spacing: 24, length: 3, colour: "#e2e8f0", snap: true },
      move: { scrollbars: true, drag: true, wheel: false },
    });
    if (initialState) {
      try {
        Blockly.serialization.workspaces.load(JSON.parse(initialState), ws);
      } catch {
        // Saved state from an older version; start fresh.
      }
    }
    const emit = () => {
      const state = JSON.stringify(Blockly.serialization.workspaces.save(ws));
      onChangeRef.current(state, javascriptGenerator.workspaceToCode(ws));
    };
    emit();
    const listener = (e: Blockly.Events.Abstract) => {
      if (!e.isUiEvent) emit();
    };
    ws.addChangeListener(listener);
    const resize = new ResizeObserver(() => Blockly.svgResize(ws));
    resize.observe(host.current);
    return () => {
      resize.disconnect();
      ws.dispose();
    };
    // initialState is only read once, when the workspace is created.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={host} className="h-full w-full" />;
}
