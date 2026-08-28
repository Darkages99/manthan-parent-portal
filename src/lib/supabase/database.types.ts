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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      approval_steps: {
        Row: {
          approver_role: Database["public"]["Enums"]["approval_step_role"]
          approver_staff_id: string | null
          created_at: string
          decided_at: string | null
          decision: Database["public"]["Enums"]["approval_decision"] | null
          id: string
          step_order: number
          subject_id: string
          subject_type: Database["public"]["Enums"]["approval_subject_type"]
        }
        Insert: {
          approver_role: Database["public"]["Enums"]["approval_step_role"]
          approver_staff_id?: string | null
          created_at?: string
          decided_at?: string | null
          decision?: Database["public"]["Enums"]["approval_decision"] | null
          id?: string
          step_order: number
          subject_id: string
          subject_type: Database["public"]["Enums"]["approval_subject_type"]
        }
        Update: {
          approver_role?: Database["public"]["Enums"]["approval_step_role"]
          approver_staff_id?: string | null
          created_at?: string
          decided_at?: string | null
          decision?: Database["public"]["Enums"]["approval_decision"] | null
          id?: string
          step_order?: number
          subject_id?: string
          subject_type?: Database["public"]["Enums"]["approval_subject_type"]
        }
        Relationships: [
          {
            foreignKeyName: "approval_steps_approver_staff_id_fkey"
            columns: ["approver_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
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
      class_subject_teachers: {
        Row: {
          class_section_id: string
          created_at: string
          id: string
          subject_id: string
          teacher_id: string
        }
        Insert: {
          class_section_id: string
          created_at?: string
          id?: string
          subject_id: string
          teacher_id: string
        }
        Update: {
          class_section_id?: string
          created_at?: string
          id?: string
          subject_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_subject_teachers_class_section_id_fkey"
            columns: ["class_section_id"]
            isOneToOne: false
            referencedRelation: "class_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_subject_teachers_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_subject_teachers_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      competitions: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          exam_date: string | null
          external_link: string | null
          id: string
          name: string
          registration_deadline: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          exam_date?: string | null
          external_link?: string | null
          id?: string
          name: string
          registration_deadline?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          exam_date?: string | null
          external_link?: string | null
          id?: string
          name?: string
          registration_deadline?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "competitions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_group_staff_access: {
        Row: {
          created_at: string
          custom_group_id: string
          granted_by: string
          staff_id: string
        }
        Insert: {
          created_at?: string
          custom_group_id: string
          granted_by: string
          staff_id: string
        }
        Update: {
          created_at?: string
          custom_group_id?: string
          granted_by?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_group_staff_access_custom_group_id_fkey"
            columns: ["custom_group_id"]
            isOneToOne: false
            referencedRelation: "custom_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_group_staff_access_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_group_staff_access_staff_id_fkey"
            columns: ["staff_id"]
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
      homework_assignments: {
        Row: {
          checked: boolean
          class_section_id: string
          created_at: string
          description: string | null
          due_date: string
          id: string
          subject_id: string | null
          teacher_id: string | null
          title: string
        }
        Insert: {
          checked?: boolean
          class_section_id: string
          created_at?: string
          description?: string | null
          due_date: string
          id?: string
          subject_id?: string | null
          teacher_id?: string | null
          title: string
        }
        Update: {
          checked?: boolean
          class_section_id?: string
          created_at?: string
          description?: string | null
          due_date?: string
          id?: string
          subject_id?: string | null
          teacher_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "homework_assignments_class_section_id_fkey"
            columns: ["class_section_id"]
            isOneToOne: false
            referencedRelation: "class_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_assignments_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_assignments_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      homework_comments: {
        Row: {
          comment: string
          created_at: string
          homework_id: string
          id: string
          staff_id: string
          student_id: string
          updated_at: string
        }
        Insert: {
          comment: string
          created_at?: string
          homework_id: string
          id?: string
          staff_id: string
          student_id: string
          updated_at?: string
        }
        Update: {
          comment?: string
          created_at?: string
          homework_id?: string
          id?: string
          staff_id?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "homework_comments_homework_id_fkey"
            columns: ["homework_id"]
            isOneToOne: false
            referencedRelation: "homework_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_comments_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_comments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      homework_notifications: {
        Row: {
          homework_id: string
          id: string
          notified_at: string
          student_id: string
        }
        Insert: {
          homework_id: string
          id?: string
          notified_at?: string
          student_id: string
        }
        Update: {
          homework_id?: string
          id?: string
          notified_at?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "homework_notifications_homework_id_fkey"
            columns: ["homework_id"]
            isOneToOne: false
            referencedRelation: "homework_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_notifications_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      homework_submissions: {
        Row: {
          created_at: string
          homework_id: string
          id: string
          student_id: string
        }
        Insert: {
          created_at?: string
          homework_id: string
          id?: string
          student_id: string
        }
        Update: {
          created_at?: string
          homework_id?: string
          id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "homework_submissions_homework_id_fkey"
            columns: ["homework_id"]
            isOneToOne: false
            referencedRelation: "homework_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_submissions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
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
      message_send_permissions: {
        Row: {
          allowed: boolean
          role: Database["public"]["Enums"]["role"]
          scope_type: Database["public"]["Enums"]["message_scope_type"]
        }
        Insert: {
          allowed?: boolean
          role: Database["public"]["Enums"]["role"]
          scope_type: Database["public"]["Enums"]["message_scope_type"]
        }
        Update: {
          allowed?: boolean
          role?: Database["public"]["Enums"]["role"]
          scope_type?: Database["public"]["Enums"]["message_scope_type"]
        }
        Relationships: []
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
      notification_log: {
        Row: {
          body: string
          category: Database["public"]["Enums"]["notification_category"]
          delivered: boolean
          id: string
          recipient_id: string
          recipient_type: string
          sent_at: string
          title: string
        }
        Insert: {
          body: string
          category: Database["public"]["Enums"]["notification_category"]
          delivered: boolean
          id?: string
          recipient_id: string
          recipient_type: string
          sent_at?: string
          title: string
        }
        Update: {
          body?: string
          category?: Database["public"]["Enums"]["notification_category"]
          delivered?: boolean
          id?: string
          recipient_id?: string
          recipient_type?: string
          sent_at?: string
          title?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          category: Database["public"]["Enums"]["notification_category"]
          created_at: string
          enabled: boolean
          guardian_id: string | null
          id: string
          staff_id: string | null
        }
        Insert: {
          category: Database["public"]["Enums"]["notification_category"]
          created_at?: string
          enabled?: boolean
          guardian_id?: string | null
          id?: string
          staff_id?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["notification_category"]
          created_at?: string
          enabled?: boolean
          guardian_id?: string | null
          id?: string
          staff_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "guardians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_preferences_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_consultations: {
        Row: {
          availability_note: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          id: string
          preferred_date: string
          requested_by: string
          scheduled_time: string | null
          status: Database["public"]["Enums"]["consultation_status"]
          student_id: string
        }
        Insert: {
          availability_note: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          id?: string
          preferred_date: string
          requested_by: string
          scheduled_time?: string | null
          status?: Database["public"]["Enums"]["consultation_status"]
          student_id: string
        }
        Update: {
          availability_note?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          id?: string
          preferred_date?: string
          requested_by?: string
          scheduled_time?: string | null
          status?: Database["public"]["Enums"]["consultation_status"]
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_consultations_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_consultations_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "guardians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_consultations_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
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
      ptm_meetings: {
        Row: {
          class_section_id: string
          created_at: string
          id: string
          meeting_date: string
          slot_minutes: number
          status: Database["public"]["Enums"]["ptm_status"]
          teacher_id: string
          title: string | null
          window_end: string | null
          window_start: string | null
        }
        Insert: {
          class_section_id: string
          created_at?: string
          id?: string
          meeting_date: string
          slot_minutes?: number
          status?: Database["public"]["Enums"]["ptm_status"]
          teacher_id: string
          title?: string | null
          window_end?: string | null
          window_start?: string | null
        }
        Update: {
          class_section_id?: string
          created_at?: string
          id?: string
          meeting_date?: string
          slot_minutes?: number
          status?: Database["public"]["Enums"]["ptm_status"]
          teacher_id?: string
          title?: string | null
          window_end?: string | null
          window_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ptm_meetings_class_section_id_fkey"
            columns: ["class_section_id"]
            isOneToOne: false
            referencedRelation: "class_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ptm_meetings_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "staff"
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
          meeting_id: string
          starts_at: string
          teacher_id: string
        }
        Insert: {
          booked_by_guardian_id?: string | null
          booked_student_id?: string | null
          class_section_id: string
          ends_at: string
          id?: string
          meeting_id: string
          starts_at: string
          teacher_id: string
        }
        Update: {
          booked_by_guardian_id?: string | null
          booked_student_id?: string | null
          class_section_id?: string
          ends_at?: string
          id?: string
          meeting_id?: string
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
            foreignKeyName: "ptm_slots_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "ptm_meetings"
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
      reminders: {
        Row: {
          created_at: string
          guardian_id: string | null
          id: string
          message: string
          remind_at: string
          sent_at: string | null
          staff_id: string | null
          subject_id: string | null
          subject_type: string | null
        }
        Insert: {
          created_at?: string
          guardian_id?: string | null
          id?: string
          message: string
          remind_at: string
          sent_at?: string | null
          staff_id?: string | null
          subject_id?: string | null
          subject_type?: string | null
        }
        Update: {
          created_at?: string
          guardian_id?: string | null
          id?: string
          message?: string
          remind_at?: string
          sent_at?: string | null
          staff_id?: string | null
          subject_id?: string | null
          subject_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reminders_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "guardians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      reported_issue_recipients: {
        Row: {
          issue_id: string
          staff_id: string
        }
        Insert: {
          issue_id: string
          staff_id: string
        }
        Update: {
          issue_id?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reported_issue_recipients_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "reported_issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reported_issue_recipients_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      reported_issues: {
        Row: {
          audience: Database["public"]["Enums"]["issue_audience"]
          body: string
          created_at: string
          id: string
          reported_by_guardian_id: string | null
          reported_by_staff_id: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["issue_status"]
          subject: string
        }
        Insert: {
          audience?: Database["public"]["Enums"]["issue_audience"]
          body: string
          created_at?: string
          id?: string
          reported_by_guardian_id?: string | null
          reported_by_staff_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["issue_status"]
          subject: string
        }
        Update: {
          audience?: Database["public"]["Enums"]["issue_audience"]
          body?: string
          created_at?: string
          id?: string
          reported_by_guardian_id?: string | null
          reported_by_staff_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["issue_status"]
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "reported_issues_reported_by_guardian_id_fkey"
            columns: ["reported_by_guardian_id"]
            isOneToOne: false
            referencedRelation: "guardians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reported_issues_reported_by_staff_id_fkey"
            columns: ["reported_by_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reported_issues_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      sheet_sync_pending_deletions: {
        Row: {
          detected_at: string
          id: string
          resolved_at: string | null
          resolved_by: string | null
          sheet_row_snapshot: Json
          subject_id: string
          subject_type: string
        }
        Insert: {
          detected_at?: string
          id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          sheet_row_snapshot: Json
          subject_id: string
          subject_type: string
        }
        Update: {
          detected_at?: string
          id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          sheet_row_snapshot?: Json
          subject_id?: string
          subject_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "sheet_sync_pending_deletions_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      sheet_sync_runs: {
        Row: {
          error_summary: string | null
          finished_at: string | null
          id: string
          started_at: string
          status: string
        }
        Insert: {
          error_summary?: string | null
          finished_at?: string | null
          id?: string
          started_at?: string
          status?: string
        }
        Update: {
          error_summary?: string | null
          finished_at?: string | null
          id?: string
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      staff: {
        Row: {
          active: boolean
          auth_user_id: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          role: Database["public"]["Enums"]["role"]
          username: string
        }
        Insert: {
          active?: boolean
          auth_user_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          role: Database["public"]["Enums"]["role"]
          username: string
        }
        Update: {
          active?: boolean
          auth_user_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["role"]
          username?: string
        }
        Relationships: []
      }
      staff_reassignment_alerts: {
        Row: {
          created_at: string
          id: string
          message: string
          resolved: boolean
          staff_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          resolved?: boolean
          staff_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          resolved?: boolean
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_reassignment_alerts_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      stay_back_consents: {
        Row: {
          created_at: string
          from_time: string
          id: string
          mode_of_transport: string | null
          principal_decided_at: string | null
          principal_decision:
            | Database["public"]["Enums"]["approval_decision"]
            | null
          purpose: Database["public"]["Enums"]["stay_back_purpose"]
          purpose_detail: string | null
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
          mode_of_transport?: string | null
          principal_decided_at?: string | null
          principal_decision?:
            | Database["public"]["Enums"]["approval_decision"]
            | null
          purpose?: Database["public"]["Enums"]["stay_back_purpose"]
          purpose_detail?: string | null
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
          mode_of_transport?: string | null
          principal_decided_at?: string | null
          principal_decision?:
            | Database["public"]["Enums"]["approval_decision"]
            | null
          purpose?: Database["public"]["Enums"]["stay_back_purpose"]
          purpose_detail?: string | null
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
      storage_usage_snapshots: {
        Row: {
          computed_at: string
          computed_by: string | null
          db_bytes: number
          file_bytes: number
          id: string
        }
        Insert: {
          computed_at?: string
          computed_by?: string | null
          db_bytes: number
          file_bytes: number
          id?: string
        }
        Update: {
          computed_at?: string
          computed_by?: string | null
          db_bytes?: number
          file_bytes?: number
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "storage_usage_snapshots_computed_by_fkey"
            columns: ["computed_by"]
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
      subjects: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      timetable_entries: {
        Row: {
          class_section_id: string
          day_of_week: number
          id: string
          period_id: string
          subject_id: string | null
          teacher_id: string | null
          updated_at: string
        }
        Insert: {
          class_section_id: string
          day_of_week: number
          id?: string
          period_id: string
          subject_id?: string | null
          teacher_id?: string | null
          updated_at?: string
        }
        Update: {
          class_section_id?: string
          day_of_week?: number
          id?: string
          period_id?: string
          subject_id?: string | null
          teacher_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "timetable_entries_class_section_id_fkey"
            columns: ["class_section_id"]
            isOneToOne: false
            referencedRelation: "class_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timetable_entries_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "timetable_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timetable_entries_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timetable_entries_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      timetable_periods: {
        Row: {
          created_at: string
          end_time: string
          id: string
          is_break: boolean
          label: string
          position: number
          start_time: string
        }
        Insert: {
          created_at?: string
          end_time: string
          id?: string
          is_break?: boolean
          label: string
          position: number
          start_time: string
        }
        Update: {
          created_at?: string
          end_time?: string
          id?: string
          is_break?: boolean
          label?: string
          position?: number
          start_time?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      attendance_summary: {
        Args: { p_student_ids: string[] }
        Returns: {
          present_pct: number
          student_id: string
          total: number
        }[]
      }
      create_student_with_guardians: {
        Args: {
          p_class_section_id: string
          p_first_name: string
          p_guardian_ids: string[]
          p_last_name: string
          p_photo_url?: string
          p_roll_no: string
        }
        Returns: string
      }
      current_guardian_id: { Args: never; Returns: string }
      current_staff_id: { Args: never; Returns: string }
      current_staff_is_issue_recipient: {
        Args: { p_issue: string }
        Returns: boolean
      }
      current_staff_role: {
        Args: never
        Returns: Database["public"]["Enums"]["role"]
      }
      database_size_bytes: { Args: never; Returns: number }
      is_principal: { Args: never; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      replace_guardian_children: {
        Args: { p_guardian: string; p_student_ids: string[] }
        Returns: undefined
      }
      sync_upsert_guardian: {
        Args: {
          p_email?: string
          p_id?: string
          p_name: string
          p_phone: string
          p_relation: string
          p_student_ids: string[]
        }
        Returns: string
      }
    }
    Enums: {
      approval_decision: "approved" | "declined"
      approval_step_role:
        | "class_teacher"
        | "front_office"
        | "coordinator"
        | "principal"
      approval_subject_type: "stay_back_consent" | "ptm_slot_request"
      attendance_status: "present" | "absent" | "late" | "half_day"
      consultation_status: "pending" | "scheduled" | "declined" | "cancelled"
      dtr_category: "exam" | "holiday" | "event" | "deadline" | "ptm" | "other"
      invoice_status: "due" | "partially_paid" | "paid" | "overdue"
      issue_audience: "principal_only" | "front_office_and_principal"
      issue_status: "open" | "resolved"
      leave_status: "pending" | "approved" | "declined"
      message_scope_type: "school" | "class" | "student" | "group"
      notification_category:
        | "stay_back"
        | "leave"
        | "ptm"
        | "messages"
        | "reminders"
        | "defaulters"
        | "consultations"
        | "homework"
      ptm_status: "open" | "closed"
      role:
        | "parent"
        | "class_teacher"
        | "front_office"
        | "accounts"
        | "principal"
        | "super_admin"
        | "coordinator"
        | "admin"
      stay_back_purpose:
        | "cultural"
        | "project"
        | "competitions_prep"
        | "ihc"
        | "others"
      stay_back_status: "pending" | "approved" | "declined"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      approval_decision: ["approved", "declined"],
      approval_step_role: [
        "class_teacher",
        "front_office",
        "coordinator",
        "principal",
      ],
      approval_subject_type: ["stay_back_consent", "ptm_slot_request"],
      attendance_status: ["present", "absent", "late", "half_day"],
      consultation_status: ["pending", "scheduled", "declined", "cancelled"],
      dtr_category: ["exam", "holiday", "event", "deadline", "ptm", "other"],
      invoice_status: ["due", "partially_paid", "paid", "overdue"],
      issue_audience: ["principal_only", "front_office_and_principal"],
      issue_status: ["open", "resolved"],
      leave_status: ["pending", "approved", "declined"],
      message_scope_type: ["school", "class", "student", "group"],
      notification_category: [
        "stay_back",
        "leave",
        "ptm",
        "messages",
        "reminders",
        "defaulters",
        "consultations",
        "homework",
      ],
      ptm_status: ["open", "closed"],
      role: [
        "parent",
        "class_teacher",
        "front_office",
        "accounts",
        "principal",
        "super_admin",
        "coordinator",
        "admin",
      ],
      stay_back_purpose: [
        "cultural",
        "project",
        "competitions_prep",
        "ihc",
        "others",
      ],
      stay_back_status: ["pending", "approved", "declined"],
    },
  },
} as const
