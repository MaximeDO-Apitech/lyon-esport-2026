import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const graphicsState = sqliteTable("graphics_state", {
  channel: text("channel").primaryKey(),
  revision: integer("revision").notNull(),
  stateJson: text("state_json").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const graphicsPresets = sqliteTable(
  "graphics_presets",
  {
    id: text("id").primaryKey(),
    templateId: text("template_id").notNull(),
    templateVersion: text("template_version").notNull(),
    name: text("name").notNull(),
    family: text("family").notNull(),
    contentJson: text("content_json").notNull(),
    validationStatus: text("validation_status").notNull(),
    resourceRevision: text("resource_revision").notNull(),
    locked: integer("locked", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("idx_presets_family_name").on(table.family, table.name)],
);

export const graphicsCommands = sqliteTable("graphics_commands", {
  id: text("id").primaryKey(),
  resultJson: text("result_json").notNull(),
  createdAt: text("created_at").notNull(),
});

export const rendererAcks = sqliteTable(
  "renderer_acks",
  {
    rendererId: text("renderer_id").notNull(),
    output: text("output").notNull(),
    revision: integer("revision").notNull(),
    appliedAt: text("applied_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.rendererId, table.output] }),
    index("idx_renderer_acks_output").on(table.output, table.appliedAt),
  ],
);
