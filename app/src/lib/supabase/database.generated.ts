export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      body_measurements: {
        Row: {
          arm_cm: number | null
          bmr_kcal: number | null
          body_fat_pct: number | null
          body_water_pct: number | null
          chest_cm: number | null
          created_at: string
          hip_cm: number | null
          id: string
          measured_on: string
          muscle_mass_kg: number | null
          neck_cm: number | null
          notes: string | null
          recorded_by: string
          source: Database["public"]["Enums"]["measurement_source"]
          student_id: string
          thigh_cm: number | null
          updated_at: string
          visceral_fat: number | null
          waist_cm: number | null
          weight_kg: number | null
          workspace_id: string
        }
        Insert: {
          arm_cm?: number | null
          bmr_kcal?: number | null
          body_fat_pct?: number | null
          body_water_pct?: number | null
          chest_cm?: number | null
          created_at?: string
          hip_cm?: number | null
          id?: string
          measured_on: string
          muscle_mass_kg?: number | null
          neck_cm?: number | null
          notes?: string | null
          recorded_by: string
          source?: Database["public"]["Enums"]["measurement_source"]
          student_id: string
          thigh_cm?: number | null
          updated_at?: string
          visceral_fat?: number | null
          waist_cm?: number | null
          weight_kg?: number | null
          workspace_id: string
        }
        Update: {
          arm_cm?: number | null
          bmr_kcal?: number | null
          body_fat_pct?: number | null
          body_water_pct?: number | null
          chest_cm?: number | null
          created_at?: string
          hip_cm?: number | null
          id?: string
          measured_on?: string
          muscle_mass_kg?: number | null
          neck_cm?: number | null
          notes?: string | null
          recorded_by?: string
          source?: Database["public"]["Enums"]["measurement_source"]
          student_id?: string
          thigh_cm?: number | null
          updated_at?: string
          visceral_fat?: number | null
          waist_cm?: number | null
          weight_kg?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "body_measurements_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "body_measurements_workspace_id_student_id_fkey"
            columns: ["workspace_id", "student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["workspace_id", "user_id"]
          },
        ]
      }
      cardio_logs: {
        Row: {
          avg_hr: number | null
          completed: boolean
          created_at: string
          distance_km: number | null
          duration_minutes: number | null
          id: string
          log_id: string
          rounds_done: number | null
          rpe: number | null
          session_exercise_id: string
          updated_at: string
        }
        Insert: {
          avg_hr?: number | null
          completed?: boolean
          created_at?: string
          distance_km?: number | null
          duration_minutes?: number | null
          id?: string
          log_id: string
          rounds_done?: number | null
          rpe?: number | null
          session_exercise_id: string
          updated_at?: string
        }
        Update: {
          avg_hr?: number | null
          completed?: boolean
          created_at?: string
          distance_km?: number | null
          duration_minutes?: number | null
          id?: string
          log_id?: string
          rounds_done?: number | null
          rpe?: number | null
          session_exercise_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cardio_logs_log_id_fkey"
            columns: ["log_id"]
            isOneToOne: false
            referencedRelation: "workout_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cardio_logs_session_exercise_id_fkey"
            columns: ["session_exercise_id"]
            isOneToOne: false
            referencedRelation: "session_exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_customizations: {
        Row: {
          created_at: string
          exercise_id: string
          instructions: string | null
          updated_at: string
          updated_by: string | null
          video_path: string | null
          video_url: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          exercise_id: string
          instructions?: string | null
          updated_at?: string
          updated_by?: string | null
          video_path?: string | null
          video_url?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          exercise_id?: string
          instructions?: string | null
          updated_at?: string
          updated_by?: string | null
          video_path?: string | null
          video_url?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercise_customizations_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_customizations_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_customizations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      exercises: {
        Row: {
          archived: boolean
          created_at: string
          created_by: string | null
          equipment: Database["public"]["Enums"]["equipment"]
          id: string
          instructions: string | null
          muscle_group: Database["public"]["Enums"]["muscle_group"]
          name: string
          updated_at: string
          video_path: string | null
          video_url: string | null
          workspace_id: string | null
        }
        Insert: {
          archived?: boolean
          created_at?: string
          created_by?: string | null
          equipment: Database["public"]["Enums"]["equipment"]
          id?: string
          instructions?: string | null
          muscle_group: Database["public"]["Enums"]["muscle_group"]
          name: string
          updated_at?: string
          video_path?: string | null
          video_url?: string | null
          workspace_id?: string | null
        }
        Update: {
          archived?: boolean
          created_at?: string
          created_by?: string | null
          equipment?: Database["public"]["Enums"]["equipment"]
          id?: string
          instructions?: string | null
          muscle_group?: Database["public"]["Enums"]["muscle_group"]
          name?: string
          updated_at?: string
          video_path?: string | null
          video_url?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exercises_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercises_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      foods: {
        Row: {
          archived: boolean
          basis: Database["public"]["Enums"]["food_basis"]
          carbs_g_per_100: number
          created_at: string
          created_by: string | null
          fat_g_per_100: number
          fiber_g_per_100: number | null
          id: string
          kcal_per_100: number
          name: string
          protein_g_per_100: number
          source: string
          unit_amount: number | null
          unit_label: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          archived?: boolean
          basis?: Database["public"]["Enums"]["food_basis"]
          carbs_g_per_100: number
          created_at?: string
          created_by?: string | null
          fat_g_per_100: number
          fiber_g_per_100?: number | null
          id?: string
          kcal_per_100: number
          name: string
          protein_g_per_100: number
          source: string
          unit_amount?: number | null
          unit_label?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          archived?: boolean
          basis?: Database["public"]["Enums"]["food_basis"]
          carbs_g_per_100?: number
          created_at?: string
          created_by?: string | null
          fat_g_per_100?: number
          fiber_g_per_100?: number | null
          id?: string
          kcal_per_100?: number
          name?: string
          protein_g_per_100?: number
          source?: string
          unit_amount?: number | null
          unit_label?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "foods_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "foods_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      hydration_goals: {
        Row: {
          created_at: string
          daily_target_ml: number
          effective_from: string
          id: string
          set_by: string | null
          student_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          daily_target_ml: number
          effective_from?: string
          id?: string
          set_by?: string | null
          student_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          daily_target_ml?: number
          effective_from?: string
          id?: string
          set_by?: string | null
          student_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hydration_goals_set_by_fkey"
            columns: ["set_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hydration_goals_workspace_id_student_id_fkey"
            columns: ["workspace_id", "student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["workspace_id", "user_id"]
          },
        ]
      }
      hydration_reminders: {
        Row: {
          enabled: boolean
          end_time: string
          interval_minutes: number
          start_time: string
          student_id: string
          updated_at: string
        }
        Insert: {
          enabled?: boolean
          end_time?: string
          interval_minutes?: number
          start_time?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          end_time?: string
          interval_minutes?: number
          start_time?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hydration_reminders_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          full_name: string
          id: string
          invited_by: string | null
          status: Database["public"]["Enums"]["invitation_status"]
          token_hash: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at: string
          full_name: string
          id?: string
          invited_by?: string | null
          status?: Database["public"]["Enums"]["invitation_status"]
          token_hash: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          full_name?: string
          id?: string
          invited_by?: string | null
          status?: Database["public"]["Enums"]["invitation_status"]
          token_hash?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_items: {
        Row: {
          created_at: string
          food_id: string
          id: string
          meal_id: string
          notes: string | null
          position: number
          quantity: number
          unit: Database["public"]["Enums"]["meal_item_unit"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          food_id: string
          id?: string
          meal_id: string
          notes?: string | null
          position?: number
          quantity: number
          unit: Database["public"]["Enums"]["meal_item_unit"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          food_id?: string
          id?: string
          meal_id?: string
          notes?: string | null
          position?: number
          quantity?: number
          unit?: Database["public"]["Enums"]["meal_item_unit"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_items_food_id_workspace_id_fkey"
            columns: ["food_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "foods"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "meal_items_meal_id_workspace_id_fkey"
            columns: ["meal_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "meals"
            referencedColumns: ["id", "workspace_id"]
          },
        ]
      }
      meal_plans: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          notes: string | null
          status: Database["public"]["Enums"]["plan_status"]
          student_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          notes?: string | null
          status?: Database["public"]["Enums"]["plan_status"]
          student_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["plan_status"]
          student_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_plans_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_plans_workspace_id_student_id_fkey"
            columns: ["workspace_id", "student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["workspace_id", "user_id"]
          },
        ]
      }
      meals: {
        Row: {
          created_at: string
          id: string
          name: string
          notes: string | null
          plan_id: string
          position: number
          time_of_day: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          plan_id: string
          position?: number
          time_of_day?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          plan_id?: string
          position?: number
          time_of_day?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meals_plan_id_workspace_id_fkey"
            columns: ["plan_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "meal_plans"
            referencedColumns: ["id", "workspace_id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_path: string | null
          created_at: string
          full_name: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          avatar_path?: string | null
          created_at?: string
          full_name: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          avatar_path?: string | null
          created_at?: string
          full_name?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      progress_photos: {
        Row: {
          created_at: string
          id: string
          pose: Database["public"]["Enums"]["photo_pose"]
          storage_path: string
          student_id: string
          taken_on: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          pose: Database["public"]["Enums"]["photo_pose"]
          storage_path: string
          student_id: string
          taken_on: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          pose?: Database["public"]["Enums"]["photo_pose"]
          storage_path?: string
          student_id?: string
          taken_on?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "progress_photos_workspace_id_student_id_fkey"
            columns: ["workspace_id", "student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["workspace_id", "user_id"]
          },
        ]
      }
      session_exercises: {
        Row: {
          cardio_mode: Database["public"]["Enums"]["cardio_mode"] | null
          created_at: string
          distance_km: number | null
          duration_minutes: number | null
          exercise_id: string
          hr_max: number | null
          hr_min: number | null
          id: string
          incline_pct: number | null
          intensity: Database["public"]["Enums"]["cardio_intensity"] | null
          kind: Database["public"]["Enums"]["exercise_kind"]
          load_kg: number | null
          notes: string | null
          position: number
          reps_max: number | null
          reps_min: number | null
          reps_per_set: number[] | null
          rest_seconds: number | null
          rounds: number | null
          session_id: string
          sets: number | null
          speed_kmh: number | null
          superset_group: string | null
          updated_at: string
          work_seconds: number | null
          workspace_id: string
        }
        Insert: {
          cardio_mode?: Database["public"]["Enums"]["cardio_mode"] | null
          created_at?: string
          distance_km?: number | null
          duration_minutes?: number | null
          exercise_id: string
          hr_max?: number | null
          hr_min?: number | null
          id?: string
          incline_pct?: number | null
          intensity?: Database["public"]["Enums"]["cardio_intensity"] | null
          kind?: Database["public"]["Enums"]["exercise_kind"]
          load_kg?: number | null
          notes?: string | null
          position?: number
          reps_max?: number | null
          reps_min?: number | null
          reps_per_set?: number[] | null
          rest_seconds?: number | null
          rounds?: number | null
          session_id: string
          sets?: number | null
          speed_kmh?: number | null
          superset_group?: string | null
          updated_at?: string
          work_seconds?: number | null
          workspace_id: string
        }
        Update: {
          cardio_mode?: Database["public"]["Enums"]["cardio_mode"] | null
          created_at?: string
          distance_km?: number | null
          duration_minutes?: number | null
          exercise_id?: string
          hr_max?: number | null
          hr_min?: number | null
          id?: string
          incline_pct?: number | null
          intensity?: Database["public"]["Enums"]["cardio_intensity"] | null
          kind?: Database["public"]["Enums"]["exercise_kind"]
          load_kg?: number | null
          notes?: string | null
          position?: number
          reps_max?: number | null
          reps_min?: number | null
          reps_per_set?: number[] | null
          rest_seconds?: number | null
          rounds?: number | null
          session_id?: string
          sets?: number | null
          speed_kmh?: number | null
          superset_group?: string | null
          updated_at?: string
          work_seconds?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_exercises_session_id_workspace_id_fkey"
            columns: ["session_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "workout_sessions"
            referencedColumns: ["id", "workspace_id"]
          },
        ]
      }
      set_logs: {
        Row: {
          completed: boolean
          created_at: string
          id: string
          load_kg: number | null
          log_id: string
          reps: number | null
          session_exercise_id: string
          set_number: number
          updated_at: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          id?: string
          load_kg?: number | null
          log_id: string
          reps?: number | null
          session_exercise_id: string
          set_number: number
          updated_at?: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          id?: string
          load_kg?: number | null
          log_id?: string
          reps?: number | null
          session_exercise_id?: string
          set_number?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "set_logs_log_id_fkey"
            columns: ["log_id"]
            isOneToOne: false
            referencedRelation: "workout_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "set_logs_session_exercise_id_fkey"
            columns: ["session_exercise_id"]
            isOneToOne: false
            referencedRelation: "session_exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          birth_date: string | null
          email: string
          experience_level:
            | Database["public"]["Enums"]["experience_level"]
            | null
          goal: string | null
          height_cm: number | null
          joined_at: string
          limitations: string | null
          sex: Database["public"]["Enums"]["sex"] | null
          status: Database["public"]["Enums"]["student_status"]
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          birth_date?: string | null
          email: string
          experience_level?:
            | Database["public"]["Enums"]["experience_level"]
            | null
          goal?: string | null
          height_cm?: number | null
          joined_at?: string
          limitations?: string | null
          sex?: Database["public"]["Enums"]["sex"] | null
          status?: Database["public"]["Enums"]["student_status"]
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          birth_date?: string | null
          email?: string
          experience_level?:
            | Database["public"]["Enums"]["experience_level"]
            | null
          goal?: string | null
          height_cm?: number | null
          joined_at?: string
          limitations?: string | null
          sex?: Database["public"]["Enums"]["sex"] | null
          status?: Database["public"]["Enums"]["student_status"]
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_workspace_id_user_id_fkey"
            columns: ["workspace_id", "user_id"]
            isOneToOne: true
            referencedRelation: "workspace_members"
            referencedColumns: ["workspace_id", "user_id"]
          },
        ]
      }
      water_logs: {
        Row: {
          amount_ml: number
          created_at: string
          id: string
          local_date: string
          logged_at: string
          student_id: string
          workspace_id: string
        }
        Insert: {
          amount_ml: number
          created_at?: string
          id?: string
          local_date?: string
          logged_at?: string
          student_id: string
          workspace_id: string
        }
        Update: {
          amount_ml?: number
          created_at?: string
          id?: string
          local_date?: string
          logged_at?: string
          student_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "water_logs_workspace_id_student_id_fkey"
            columns: ["workspace_id", "student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["workspace_id", "user_id"]
          },
        ]
      }
      workout_logs: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          notes: string | null
          plan_id: string
          session_id: string
          started_at: string
          student_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          plan_id: string
          session_id: string
          started_at?: string
          student_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          plan_id?: string
          session_id?: string
          started_at?: string
          student_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_logs_plan_id_workspace_id_fkey"
            columns: ["plan_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "workout_plans"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "workout_logs_session_id_workspace_id_fkey"
            columns: ["session_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "workout_sessions"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "workout_logs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_plans: {
        Row: {
          created_at: string
          created_by: string | null
          ends_on: string | null
          id: string
          name: string
          notes: string | null
          starts_on: string | null
          status: Database["public"]["Enums"]["plan_status"]
          student_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          ends_on?: string | null
          id?: string
          name: string
          notes?: string | null
          starts_on?: string | null
          status?: Database["public"]["Enums"]["plan_status"]
          student_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          ends_on?: string | null
          id?: string
          name?: string
          notes?: string | null
          starts_on?: string | null
          status?: Database["public"]["Enums"]["plan_status"]
          student_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_plans_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_plans_workspace_id_student_id_fkey"
            columns: ["workspace_id", "student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["workspace_id", "user_id"]
          },
        ]
      }
      workout_sessions: {
        Row: {
          created_at: string
          id: string
          name: string
          plan_id: string
          position: number
          updated_at: string
          weekdays: number[]
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          plan_id: string
          position?: number
          updated_at?: string
          weekdays?: number[]
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          plan_id?: string
          position?: number
          updated_at?: string
          weekdays?: number[]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_sessions_plan_id_workspace_id_fkey"
            columns: ["plan_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "workout_plans"
            referencedColumns: ["id", "workspace_id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          created_at: string
          role: Database["public"]["Enums"]["workspace_role"]
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          role: Database["public"]["Enums"]["workspace_role"]
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          role?: Database["public"]["Enums"]["workspace_role"]
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspaces_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invitation: { Args: { p_token: string }; Returns: string }
      create_student_invitation: {
        Args: { p_email: string; p_full_name: string; p_workspace_id: string }
        Returns: {
          expires_at: string
          invitation_id: string
          token: string
        }[]
      }
      get_invitation: {
        Args: { p_token: string }
        Returns: {
          email: string
          expires_at: string
          full_name: string
          trainer_name: string
          workspace_name: string
        }[]
      }
      refresh_student_invitation: {
        Args: { p_invitation_id: string }
        Returns: {
          expires_at: string
          invitation_id: string
          token: string
        }[]
      }
      remove_student: {
        Args: { p_user_id: string; p_workspace_id: string }
        Returns: undefined
      }
      revoke_student_invitation: {
        Args: { p_invitation_id: string }
        Returns: undefined
      }
    }
    Enums: {
      cardio_intensity: "light" | "moderate" | "vigorous"
      cardio_mode: "continuous" | "intervals"
      equipment:
        | "barbell"
        | "dumbbell"
        | "machine"
        | "cable"
        | "bodyweight"
        | "kettlebell"
        | "band"
        | "other"
      exercise_kind: "strength" | "cardio"
      experience_level: "beginner" | "intermediate" | "advanced"
      food_basis: "g" | "ml"
      invitation_status: "pending" | "accepted" | "revoked"
      meal_item_unit: "g" | "ml" | "unit"
      measurement_source: "manual" | "bioimpedance"
      muscle_group:
        | "chest"
        | "back"
        | "shoulders"
        | "biceps"
        | "triceps"
        | "forearms"
        | "core"
        | "quadriceps"
        | "hamstrings"
        | "glutes"
        | "calves"
        | "full_body"
        | "cardio"
      photo_pose: "front" | "side" | "back"
      plan_status: "draft" | "active" | "archived"
      sex: "female" | "male"
      student_status: "active" | "archived"
      user_role: "trainer" | "student"
      workspace_role: "owner" | "trainer" | "student"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      cardio_intensity: ["light", "moderate", "vigorous"],
      cardio_mode: ["continuous", "intervals"],
      equipment: [
        "barbell",
        "dumbbell",
        "machine",
        "cable",
        "bodyweight",
        "kettlebell",
        "band",
        "other",
      ],
      exercise_kind: ["strength", "cardio"],
      experience_level: ["beginner", "intermediate", "advanced"],
      food_basis: ["g", "ml"],
      invitation_status: ["pending", "accepted", "revoked"],
      meal_item_unit: ["g", "ml", "unit"],
      measurement_source: ["manual", "bioimpedance"],
      muscle_group: [
        "chest",
        "back",
        "shoulders",
        "biceps",
        "triceps",
        "forearms",
        "core",
        "quadriceps",
        "hamstrings",
        "glutes",
        "calves",
        "full_body",
        "cardio",
      ],
      photo_pose: ["front", "side", "back"],
      plan_status: ["draft", "active", "archived"],
      sex: ["female", "male"],
      student_status: ["active", "archived"],
      user_role: ["trainer", "student"],
      workspace_role: ["owner", "trainer", "student"],
    },
  },
} as const
