// Generated schema lives in database.generated.ts. Regenerate it with:
//   npx supabase gen types typescript --linked --schema public > src/lib/supabase/database.generated.ts
// This file only adds short aliases for the enums used across the app.
import type { Enums } from "./database.generated";

export type { Database, Json, Tables, TablesInsert, TablesUpdate, Enums } from "./database.generated";

export type UserRole = Enums<"user_role">;
export type WorkspaceRole = Enums<"workspace_role">;
export type InvitationStatus = Enums<"invitation_status">;
export type StudentStatus = Enums<"student_status">;
export type ExperienceLevel = Enums<"experience_level">;
export type MuscleGroup = Enums<"muscle_group">;
export type Equipment = Enums<"equipment">;
export type PlanStatus = Enums<"plan_status">;
export type FoodBasis = Enums<"food_basis">;
export type MealItemUnit = Enums<"meal_item_unit">;
export type Sex = Enums<"sex">;
export type MeasurementSource = Enums<"measurement_source">;
export type PhotoPose = Enums<"photo_pose">;
