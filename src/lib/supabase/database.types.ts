// Generated via `mcp__claude_ai_Supabase__generate_typescript_types` against
// the live "manthan-parent-portal" project. Regenerate after schema changes
// rather than hand-editing.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      attendance_records: {
        Row: {
          date: string
          id: string
          marked_by: string | null
          status: Database["public"]["Enums"]["attendance_status"]
          student_id: string
        }
        Insert: {
          date: string
          id?: string
          marked_by?: string | null
          status: Database["public"]["Enums"]["attendance_status"]
          student_id: string
        }
        Update: {
          date?: string
          id?: string
          marked_by?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_marked_by_fkey"
            columns: ["marked_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      class_sections: {
        Row: {
          academic_year: string
          class_teacher_id: string | null
          grade: string
          id: string
          section: string
        }
        Insert: {
          academic_year: string
          class_teacher_id?: string | null
          grade: string
          id?: string
          section: string
        }
        Update: {
          academic_year?: string
          class_teacher_id?: string | null
          grade?: string
          id?: string
          section?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_sections_class_teacher_id_fkey"
            columns: ["class_teacher_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_group_students: {
        Row: {
          custom_group_id: string
          student_id: string
        }
        Insert: {
          custom_group_id: string
          student_id: string
        }
        Update: {
          custom_group_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_group_students_custom_group_id_fkey"
            columns: ["custom_group_id"]
            isOneToOne: false
            referencedRelation: "custom_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_group_students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_groups: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_groups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      defaulter_records: {
        Row: {
          action_taken: string | null
          created_at: string
          description: string
          id: string
          incident_date: string
          recorded_by: string | null
          student_id: string
        }
        Insert: {
          action_taken?: string | null
          created_at?: string
          description: string
          id?: string
          incident_date: string
          recorded_by?: string | null
          student_id: string
        }
        Update: {
          action_taken?: string | null
          created_at?: string
          description?: string
          id?: string
          incident_date?: string
          recorded_by?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "defaulter_records_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "defaulter_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      dtr_event_classes: {
        Row: {
          class_section_id: string
          dtr_event_id: string
        }
        Insert: {
          class_section_id: string
          dtr_event_id: string
        }
        Update: {
          class_section_id?: string
          dtr_event_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dtr_event_classes_class_section_id_fkey"
            columns: ["class_section_id"]
            isOneToOne: false
            referencedRelation: "class_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dtr_event_classes_dtr_event_id_fkey"
            columns: ["dtr_event_id"]
            isOneToOne: false
            referencedRelation: "dtr_events"
            referencedColumns: ["id"]
          },
        ]
      }
      dtr_events: {
        Row: {
          category: Database["public"]["Enums"]["dtr_category"]
          created_at: string
          created_by: string | null
          description: string | null
          event_date: string
          id: string
          title: string
        }
        Insert: {
          category: Database["public"]["Enums"]["dtr_category"]
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_date: string
          id?: string
          title: string
        }
        Update: {
          category?: Database["public"]["Enums"]["dtr_category"]
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_date?: string
          id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "dtr_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_results: {
        Row: {
          grade: string | null
          id: string
          marks: number
          max_marks: number
          report_card_pdf_url: string | null
          student_id: string
          subject: string
          term: string
        }
        Insert: {
          grade?: string | null
          id?: string
          marks: number
          max_marks: number
          report_card_pdf_url?: string | null
          student_id: string
          subject: string
          term: string
        }
        Update: {
          grade?: string | null
          id?: string
          marks?: number
          max_marks?: number
          report_card_pdf_url?: string | null
          student_id?: string
          subject?: string
          term?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_results_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      guardian_student: {
        Row: {
          guardian_id: string
          student_id: string
        }
        Insert: {
          guardian_id: string
          student_id: string
        }
        Update: {
          guardian_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guardian_student_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "guardians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guardian_student_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      guardians: {
        Row: {
          auth_user_id: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string
          relation: string
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone: string
          relation: string
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string
          relation?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          amount_paise: number
          created_at: string
          due_date: string
          fee_head: string
          id: string
          status: Database["public"]["Enums"]["invoice_status"]
          student_id: string
        }
        Insert: {
          amount_paise: number
          created_at?: string
          due_date: string
          fee_head: string
          id?: string
          status?: Database["public"]["Enums"]["invoice_status"]
          student_id: string
        }
        Update: {
          amount_paise?: number
          created_at?: string
          due_date?: string
          fee_head?: string
          id?: string
          status?: Database["public"]["Enums"]["invoice_status"]
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          from_date: string
          id: string
          reason: string
          requested_by: string
          status: Database["public"]["Enums"]["leave_status"]
          student_id: string
          to_date: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          from_date: string
          id?: string
          reason: string
          requested_by: string
          status?: Database["public"]["Enums"]["leave_status"]
          student_id: string
          to_date: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          from_date?: string
          id?: string
          reason?: string
          requested_by?: string
          status?: Database["public"]["Enums"]["leave_status"]
          student_id?: string
          to_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "guardians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      message_attachments: {
        Row: {
          file_name: string
          id: string
          message_id: string
          size_bytes: number
          storage_url: string
        }
        Insert: {
          file_name: string
          id?: string
          message_id: string
          size_bytes: number
          storage_url: string
        }
        Update: {
          file_name?: string
          id?: string
          message_id?: string
          size_bytes?: number
          storage_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      message_receipts: {
        Row: {
          delivered_at: string | null
          guardian_id: string
          message_id: string
          read_at: string | null
        }
        Insert: {
          delivered_at?: string | null
          guardian_id: string
          message_id: string
          read_at?: string | null
        }
        Update: {
          delivered_at?: string | null
          guardian_id?: string
          message_id?: string
          read_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_receipts_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "guardians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_receipts_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      message_targets: {
        Row: {
          class_section_id: string | null
          custom_group_id: string | null
          message_id: string
          student_id: string | null
        }
        Insert: {
          class_section_id?: string | null
          custom_group_id?: string | null
          message_id: string
          student_id?: string | null
        }
        Update: {
          class_section_id?: string | null
          custom_group_id?: string | null
          message_id?: string
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_targets_class_section_id_fkey"
            columns: ["class_section_id"]
            isOneToOne: false
            referencedRelation: "class_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_targets_custom_group_id_fkey"
            columns: ["custom_group_id"]
            isOneToOne: false
            referencedRelation: "custom_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_targets_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_targets_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          created_at: string
          id: string
          scheduled_for: string | null
          scope_type: Database["public"]["Enums"]["message_scope_type"]
          sender_id: string
          sent_at: string | null
          subject: string
          urgent: boolean
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          scheduled_for?: string | null
          scope_type: Database["public"]["Enums"]["message_scope_type"]
          sender_id: string
          sent_at?: string | null
          subject: string
          urgent?: boolean
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          scheduled_for?: string | null
          scope_type?: Database["public"]["Enums"]["message_scope_type"]
          sender_id?: string
          sent_at?: string | null
          subject?: string
          urgent?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_paise: number
          gateway_reference: string
          id: string
          invoice_id: string
          paid_at: string
          receipt_pdf_url: string | null
        }
        Insert: {
          amount_paise: number
          gateway_reference: string
          id?: string
          invoice_id: string
          paid_at?: string
          receipt_pdf_url?: string | null
        }
        Update: {
          amount_paise?: number
          gateway_reference?: string
          id?: string
          invoice_id?: string
          paid_at?: string
          receipt_pdf_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      ptm_slots: {
        Row: {
          booked_by_guardian_id: string | null
          booked_student_id: string | null
          class_section_id: string
          ends_at: string
          id: string
          starts_at: string
          teacher_id: string
        }
        Insert: {
          booked_by_guardian_id?: string | null
          booked_student_id?: string | null
          class_section_id: string
          ends_at: string
          id?: string
          starts_at: string
          teacher_id: string
        }
        Update: {
          booked_by_guardian_id?: string | null
          booked_student_id?: string | null
          class_section_id?: string
          ends_at?: string
          id?: string
          starts_at?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ptm_slots_booked_by_guardian_id_fkey"
            columns: ["booked_by_guardian_id"]
            isOneToOne: false
            referencedRelation: "guardians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ptm_slots_booked_student_id_fkey"
            columns: ["booked_student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ptm_slots_class_section_id_fkey"
            columns: ["class_section_id"]
            isOneToOne: false
            referencedRelation: "class_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ptm_slots_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          guardian_id: string | null
          id: string
          p256dh: string
          staff_id: string | null
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          guardian_id?: string | null
          id?: string
          p256dh: string
          staff_id?: string | null
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          guardian_id?: string | null
          id?: string
          p256dh?: string
          staff_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "guardians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_subscriptions_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          auth_user_id: string | null
          created_at: string
          id: string
          name: string
          phone: string
          role: Database["public"]["Enums"]["role"]
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string
          id?: string
          name: string
          phone: string
          role: Database["public"]["Enums"]["role"]
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string
          id?: string
          name?: string
          phone?: string
          role?: Database["public"]["Enums"]["role"]
        }
        Relationships: []
      }
      stay_back_consents: {
        Row: {
          created_at: string
          from_time: string
          id: string
          principal_decided_at: string | null
          principal_decision:
            | Database["public"]["Enums"]["approval_decision"]
            | null
          raised_by_guardian_id: string
          reason: string
          status: Database["public"]["Enums"]["stay_back_status"]
          stay_date: string
          student_id: string
          teacher_decided_at: string | null
          teacher_decision:
            | Database["public"]["Enums"]["approval_decision"]
            | null
          teacher_id: string
          to_time: string
        }
        Insert: {
          created_at?: string
          from_time: string
          id?: string
          principal_decided_at?: string | null
          principal_decision?:
            | Database["public"]["Enums"]["approval_decision"]
            | null
          raised_by_guardian_id: string
          reason: string
          status?: Database["public"]["Enums"]["stay_back_status"]
          stay_date: string
          student_id: string
          teacher_decided_at?: string | null
          teacher_decision?:
            | Database["public"]["Enums"]["approval_decision"]
            | null
          teacher_id: string
          to_time: string
        }
        Update: {
          created_at?: string
          from_time?: string
          id?: string
          principal_decided_at?: string | null
          principal_decision?:
            | Database["public"]["Enums"]["approval_decision"]
            | null
          raised_by_guardian_id?: string
          reason?: string
          status?: Database["public"]["Enums"]["stay_back_status"]
          stay_date?: string
          student_id?: string
          teacher_decided_at?: string | null
          teacher_decision?:
            | Database["public"]["Enums"]["approval_decision"]
            | null
          teacher_id?: string
          to_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "stay_back_consents_raised_by_guardian_id_fkey"
            columns: ["raised_by_guardian_id"]
            isOneToOne: false
            referencedRelation: "guardians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stay_back_consents_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stay_back_consents_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      student_qr_codes: {
        Row: {
          issued_at: string
          issued_by: string | null
          student_id: string
          token: string
        }
        Insert: {
          issued_at?: string
          issued_by?: string | null
          student_id: string
          token?: string
        }
        Update: {
          issued_at?: string
          issued_by?: string | null
          student_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_qr_codes_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_qr_codes_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          class_section_id: string
          created_at: string
          first_name: string
          id: string
          last_name: string
          photo_url: string | null
          roll_no: string
        }
        Insert: {
          class_section_id: string
          created_at?: string
          first_name: string
          id?: string
          last_name: string
          photo_url?: string | null
          roll_no: string
        }
        Update: {
          class_section_id?: string
          created_at?: string
          first_name?: string
          id?: string
          last_name?: string
          photo_url?: string | null
          roll_no?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_class_section_id_fkey"
            columns: ["class_section_id"]
            isOneToOne: false
            referencedRelation: "class_sections"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      approval_decision: "approved" | "declined"
      attendance_status: "present" | "absent" | "late" | "excused"
      dtr_category: "exam" | "holiday" | "event" | "deadline" | "ptm" | "other"
      invoice_status: "due" | "partially_paid" | "paid" | "overdue"
      leave_status: "pending" | "approved" | "declined"
      message_scope_type: "school" | "class" | "student" | "group"
      role:
        | "parent"
        | "class_teacher"
        | "front_office"
        | "accounts"
        | "principal"
        | "super_admin"
      stay_back_status: "pending" | "approved" | "declined"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database["public"]

export type Tables<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Row"]
export type TablesInsert<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Update"]
export type Enums<T extends keyof DefaultSchema["Enums"]> =
  DefaultSchema["Enums"][T]
