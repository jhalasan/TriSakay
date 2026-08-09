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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      account_actions: {
        Row: {
          action_type: Database["public"]["Enums"]["account_action_type"]
          complaint_id: string | null
          created_at: string
          id: string
          performed_by: string
          reason: string
          target_user_id: string
        }
        Insert: {
          action_type: Database["public"]["Enums"]["account_action_type"]
          complaint_id?: string | null
          created_at?: string
          id?: string
          performed_by: string
          reason: string
          target_user_id: string
        }
        Update: {
          action_type?: Database["public"]["Enums"]["account_action_type"]
          complaint_id?: string | null
          created_at?: string
          id?: string
          performed_by?: string
          reason?: string
          target_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_actions_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "complaints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_actions_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "v_overdue_complaints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_actions_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_actions_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      barangays: {
        Row: {
          cluster: Database["public"]["Enums"]["tricycle_cluster"] | null
          created_at: string
          id: string
          is_split: boolean
          name: string
          notes: string | null
        }
        Insert: {
          cluster?: Database["public"]["Enums"]["tricycle_cluster"] | null
          created_at?: string
          id?: string
          is_split?: boolean
          name: string
          notes?: string | null
        }
        Update: {
          cluster?: Database["public"]["Enums"]["tricycle_cluster"] | null
          created_at?: string
          id?: string
          is_split?: boolean
          name?: string
          notes?: string | null
        }
        Relationships: []
      }
      complaint_attachments: {
        Row: {
          complaint_id: string
          created_at: string
          id: string
          storage_path: string
          uploaded_by: string
        }
        Insert: {
          complaint_id: string
          created_at?: string
          id?: string
          storage_path: string
          uploaded_by: string
        }
        Update: {
          complaint_id?: string
          created_at?: string
          id?: string
          storage_path?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "complaint_attachments_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "complaints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "complaint_attachments_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "v_overdue_complaints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "complaint_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      complaints: {
        Row: {
          against_user_id: string | null
          category: Database["public"]["Enums"]["complaint_category"]
          created_at: string
          dh_directive: string | null
          dh_reviewed_at: string | null
          dh_reviewed_by: string | null
          id: string
          mediation_location: string | null
          mediation_meeting_at: string | null
          mediation_scheduled_at: string | null
          mediation_scheduled_by: string | null
          message: string
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          ride_request_id: string | null
          status: Database["public"]["Enums"]["complaint_status"]
          subject: string
          submitted_by: string
          triaged_at: string | null
          triaged_by: string | null
          updated_at: string
        }
        Insert: {
          against_user_id?: string | null
          category?: Database["public"]["Enums"]["complaint_category"]
          created_at?: string
          dh_directive?: string | null
          dh_reviewed_at?: string | null
          dh_reviewed_by?: string | null
          id?: string
          mediation_location?: string | null
          mediation_meeting_at?: string | null
          mediation_scheduled_at?: string | null
          mediation_scheduled_by?: string | null
          message: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          ride_request_id?: string | null
          status?: Database["public"]["Enums"]["complaint_status"]
          subject: string
          submitted_by: string
          triaged_at?: string | null
          triaged_by?: string | null
          updated_at?: string
        }
        Update: {
          against_user_id?: string | null
          category?: Database["public"]["Enums"]["complaint_category"]
          created_at?: string
          dh_directive?: string | null
          dh_reviewed_at?: string | null
          dh_reviewed_by?: string | null
          id?: string
          mediation_location?: string | null
          mediation_meeting_at?: string | null
          mediation_scheduled_at?: string | null
          mediation_scheduled_by?: string | null
          message?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          ride_request_id?: string | null
          status?: Database["public"]["Enums"]["complaint_status"]
          subject?: string
          submitted_by?: string
          triaged_at?: string | null
          triaged_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "complaints_against_user_id_fkey"
            columns: ["against_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "complaints_dh_reviewed_by_fkey"
            columns: ["dh_reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "complaints_mediation_scheduled_by_fkey"
            columns: ["mediation_scheduled_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "complaints_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "complaints_ride_request_id_fkey"
            columns: ["ride_request_id"]
            isOneToOne: false
            referencedRelation: "ride_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "complaints_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "complaints_triaged_by_fkey"
            columns: ["triaged_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_documents: {
        Row: {
          created_at: string
          doc_type: Database["public"]["Enums"]["document_type"]
          driver_id: string
          id: string
          remarks: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["verification_status"]
          storage_path: string
          tricycle_id: string | null
        }
        Insert: {
          created_at?: string
          doc_type: Database["public"]["Enums"]["document_type"]
          driver_id: string
          id?: string
          remarks?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["verification_status"]
          storage_path: string
          tricycle_id?: string | null
        }
        Update: {
          created_at?: string
          doc_type?: Database["public"]["Enums"]["document_type"]
          driver_id?: string
          id?: string
          remarks?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["verification_status"]
          storage_path?: string
          tricycle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_documents_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "driver_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "driver_documents_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "v_flagged_low_ratings"
            referencedColumns: ["driver_id"]
          },
          {
            foreignKeyName: "driver_documents_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_documents_tricycle_id_fkey"
            columns: ["tricycle_id"]
            isOneToOne: false
            referencedRelation: "tricycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_documents_tricycle_id_fkey"
            columns: ["tricycle_id"]
            isOneToOne: false
            referencedRelation: "v_expiring_franchises"
            referencedColumns: ["tricycle_id"]
          },
        ]
      }
      driver_profiles: {
        Row: {
          created_at: string
          current_lat: number | null
          current_lng: number | null
          declared_dest_lat: number | null
          declared_dest_lng: number | null
          is_available: boolean
          license_no: string | null
          location_updated_at: string | null
          rating_avg: number
          rating_count: number
          updated_at: string
          user_id: string
          verification_status: Database["public"]["Enums"]["verification_status"]
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          created_at?: string
          current_lat?: number | null
          current_lng?: number | null
          declared_dest_lat?: number | null
          declared_dest_lng?: number | null
          is_available?: boolean
          license_no?: string | null
          location_updated_at?: string | null
          rating_avg?: number
          rating_count?: number
          updated_at?: string
          user_id: string
          verification_status?: Database["public"]["Enums"]["verification_status"]
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          created_at?: string
          current_lat?: number | null
          current_lng?: number | null
          declared_dest_lat?: number | null
          declared_dest_lng?: number | null
          is_available?: boolean
          license_no?: string | null
          location_updated_at?: string | null
          rating_avg?: number
          rating_count?: number
          updated_at?: string
          user_id?: string
          verification_status?: Database["public"]["Enums"]["verification_status"]
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_profiles_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      fare_config: {
        Row: {
          base_fare: number
          base_km: number
          created_at: string
          discount_rate_percent: number
          effective_from: string
          id: string
          is_active: boolean
          ordinance_ref: string | null
          rate_per_km: number
          updated_by: string | null
        }
        Insert: {
          base_fare: number
          base_km: number
          created_at?: string
          discount_rate_percent?: number
          effective_from?: string
          id?: string
          is_active?: boolean
          ordinance_ref?: string | null
          rate_per_km: number
          updated_by?: string | null
        }
        Update: {
          base_fare?: number
          base_km?: number
          created_at?: string
          discount_rate_percent?: number
          effective_from?: string
          id?: string
          is_active?: boolean
          ordinance_ref?: string | null
          rate_per_km?: number
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fare_config_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          ref_id: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          ref_id?: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          ref_id?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      passenger_discounts: {
        Row: {
          category: Database["public"]["Enums"]["discount_category"]
          id: string
          id_photo_back_path: string
          id_photo_front_path: string
          passenger_id: string
          remarks: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["verification_status"]
          submitted_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["discount_category"]
          id?: string
          id_photo_back_path: string
          id_photo_front_path: string
          passenger_id: string
          remarks?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["verification_status"]
          submitted_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["discount_category"]
          id?: string
          id_photo_back_path?: string
          id_photo_front_path?: string
          passenger_id?: string
          remarks?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["verification_status"]
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "passenger_discounts_passenger_id_fkey"
            columns: ["passenger_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "passenger_discounts_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      ratings: {
        Row: {
          comment: string | null
          created_at: string
          driver_id: string
          id: string
          passenger_id: string
          ride_request_id: string
          stars: number
        }
        Insert: {
          comment?: string | null
          created_at?: string
          driver_id: string
          id?: string
          passenger_id: string
          ride_request_id: string
          stars: number
        }
        Update: {
          comment?: string | null
          created_at?: string
          driver_id?: string
          id?: string
          passenger_id?: string
          ride_request_id?: string
          stars?: number
        }
        Relationships: [
          {
            foreignKeyName: "ratings_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "driver_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "ratings_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "v_flagged_low_ratings"
            referencedColumns: ["driver_id"]
          },
          {
            foreignKeyName: "ratings_passenger_id_fkey"
            columns: ["passenger_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_ride_request_id_fkey"
            columns: ["ride_request_id"]
            isOneToOne: true
            referencedRelation: "ride_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      ride_requests: {
        Row: {
          assigned_at: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          completed_at: string | null
          dest_label: string | null
          dest_lat: number
          dest_lng: number
          discount_applied: boolean
          discount_percent: number | null
          distance_km: number | null
          estimated_fare: number | null
          final_fare: number | null
          id: string
          passenger_id: string
          picked_up_at: string | null
          pickup_barangay_id: string | null
          pickup_label: string | null
          pickup_lat: number
          pickup_lng: number
          preferred_method: Database["public"]["Enums"]["payment_method"]
          requested_at: string
          seats_requested: number
          status: Database["public"]["Enums"]["ride_status"]
          trip_id: string | null
        }
        Insert: {
          assigned_at?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          dest_label?: string | null
          dest_lat: number
          dest_lng: number
          discount_applied?: boolean
          discount_percent?: number | null
          distance_km?: number | null
          estimated_fare?: number | null
          final_fare?: number | null
          id?: string
          passenger_id: string
          picked_up_at?: string | null
          pickup_barangay_id?: string | null
          pickup_label?: string | null
          pickup_lat: number
          pickup_lng: number
          preferred_method?: Database["public"]["Enums"]["payment_method"]
          requested_at?: string
          seats_requested?: number
          status?: Database["public"]["Enums"]["ride_status"]
          trip_id?: string | null
        }
        Update: {
          assigned_at?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          dest_label?: string | null
          dest_lat?: number
          dest_lng?: number
          discount_applied?: boolean
          discount_percent?: number | null
          distance_km?: number | null
          estimated_fare?: number | null
          final_fare?: number | null
          id?: string
          passenger_id?: string
          picked_up_at?: string | null
          pickup_barangay_id?: string | null
          pickup_label?: string | null
          pickup_lat?: number
          pickup_lng?: number
          preferred_method?: Database["public"]["Enums"]["payment_method"]
          requested_at?: string
          seats_requested?: number
          status?: Database["public"]["Enums"]["ride_status"]
          trip_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ride_requests_passenger_id_fkey"
            columns: ["passenger_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_requests_pickup_barangay_id_fkey"
            columns: ["pickup_barangay_id"]
            isOneToOne: false
            referencedRelation: "barangays"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_requests_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          bearing_tolerance_deg: number
          detour_ratio_max: number
          id: string
          is_active: boolean
          low_rating_threshold: number
          search_radius_km: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          bearing_tolerance_deg?: number
          detour_ratio_max?: number
          id?: string
          is_active?: boolean
          low_rating_threshold?: number
          search_radius_km?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          bearing_tolerance_deg?: number
          detour_ratio_max?: number
          id?: string
          is_active?: boolean
          low_rating_threshold?: number
          search_radius_km?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "system_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          cash_confirmed_at: string | null
          cash_confirmed_by: string | null
          created_at: string
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          paymongo_payload: Json | null
          paymongo_session_id: string | null
          ride_request_id: string
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          cash_confirmed_at?: string | null
          cash_confirmed_by?: string | null
          created_at?: string
          id?: string
          method: Database["public"]["Enums"]["payment_method"]
          paymongo_payload?: Json | null
          paymongo_session_id?: string | null
          ride_request_id: string
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          cash_confirmed_at?: string | null
          cash_confirmed_by?: string | null
          created_at?: string
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          paymongo_payload?: Json | null
          paymongo_session_id?: string | null
          ride_request_id?: string
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_cash_confirmed_by_fkey"
            columns: ["cash_confirmed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_ride_request_id_fkey"
            columns: ["ride_request_id"]
            isOneToOne: true
            referencedRelation: "ride_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      tricycles: {
        Row: {
          body_no: string | null
          cluster: Database["public"]["Enums"]["tricycle_cluster"] | null
          created_at: string
          driver_id: string
          id: string
          is_active: boolean
          mtop_expiry_date: string | null
          mtop_no: string | null
          plate_no: string
          seat_capacity: number
          updated_at: string
          verification_status: Database["public"]["Enums"]["verification_status"]
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          body_no?: string | null
          cluster?: Database["public"]["Enums"]["tricycle_cluster"] | null
          created_at?: string
          driver_id: string
          id?: string
          is_active?: boolean
          mtop_expiry_date?: string | null
          mtop_no?: string | null
          plate_no: string
          seat_capacity?: number
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["verification_status"]
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          body_no?: string | null
          cluster?: Database["public"]["Enums"]["tricycle_cluster"] | null
          created_at?: string
          driver_id?: string
          id?: string
          is_active?: boolean
          mtop_expiry_date?: string | null
          mtop_no?: string | null
          plate_no?: string
          seat_capacity?: number
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["verification_status"]
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tricycles_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "driver_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "tricycles_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "v_flagged_low_ratings"
            referencedColumns: ["driver_id"]
          },
          {
            foreignKeyName: "tricycles_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          completed_at: string | null
          created_at: string
          declared_dest_lat: number | null
          declared_dest_lng: number | null
          driver_id: string
          id: string
          max_seats: number
          origin_lat: number | null
          origin_lng: number | null
          started_at: string | null
          status: Database["public"]["Enums"]["trip_status"]
          tricycle_id: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          declared_dest_lat?: number | null
          declared_dest_lng?: number | null
          driver_id: string
          id?: string
          max_seats?: number
          origin_lat?: number | null
          origin_lng?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["trip_status"]
          tricycle_id: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          declared_dest_lat?: number | null
          declared_dest_lng?: number | null
          driver_id?: string
          id?: string
          max_seats?: number
          origin_lat?: number | null
          origin_lng?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["trip_status"]
          tricycle_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trips_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "driver_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "trips_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "v_flagged_low_ratings"
            referencedColumns: ["driver_id"]
          },
          {
            foreignKeyName: "trips_tricycle_id_fkey"
            columns: ["tricycle_id"]
            isOneToOne: false
            referencedRelation: "tricycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_tricycle_id_fkey"
            columns: ["tricycle_id"]
            isOneToOne: false
            referencedRelation: "v_expiring_franchises"
            referencedColumns: ["tricycle_id"]
          },
        ]
      }
      user_consents: {
        Row: {
          accepted_at: string
          id: string
          policy_type: string
          policy_version: string
          user_id: string
        }
        Insert: {
          accepted_at?: string
          id?: string
          policy_type: string
          policy_version: string
          user_id: string
        }
        Update: {
          accepted_at?: string
          id?: string
          policy_type?: string
          policy_version?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_consents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          contact_no: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          status: Database["public"]["Enums"]["account_status"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          contact_no?: string | null
          created_at?: string
          email: string
          full_name: string
          id: string
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          contact_no?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_driver_earnings: {
        Row: {
          driver_id: string | null
          earning_date: string | null
          rides_completed: number | null
          total_collected: number | null
        }
        Relationships: [
          {
            foreignKeyName: "trips_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "driver_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "trips_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "v_flagged_low_ratings"
            referencedColumns: ["driver_id"]
          },
        ]
      }
      v_expiring_franchises: {
        Row: {
          days_until_expiry: number | null
          driver_id: string | null
          mtop_expiry_date: string | null
          mtop_no: string | null
          plate_no: string | null
          tricycle_id: string | null
        }
        Insert: {
          days_until_expiry?: never
          driver_id?: string | null
          mtop_expiry_date?: string | null
          mtop_no?: string | null
          plate_no?: string | null
          tricycle_id?: string | null
        }
        Update: {
          days_until_expiry?: never
          driver_id?: string | null
          mtop_expiry_date?: string | null
          mtop_no?: string | null
          plate_no?: string | null
          tricycle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tricycles_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "driver_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "tricycles_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "v_flagged_low_ratings"
            referencedColumns: ["driver_id"]
          },
        ]
      }
      v_flagged_low_ratings: {
        Row: {
          driver_id: string | null
          full_name: string | null
          rating_avg: number | null
          rating_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_profiles_user_id_fkey"
            columns: ["driver_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      v_overdue_complaints: {
        Row: {
          against_user_id: string | null
          business_days_elapsed: number | null
          category: Database["public"]["Enums"]["complaint_category"] | null
          created_at: string | null
          id: string | null
          status: Database["public"]["Enums"]["complaint_status"] | null
          submitted_by: string | null
        }
        Insert: {
          against_user_id?: string | null
          business_days_elapsed?: never
          category?: Database["public"]["Enums"]["complaint_category"] | null
          created_at?: string | null
          id?: string | null
          status?: Database["public"]["Enums"]["complaint_status"] | null
          submitted_by?: string | null
        }
        Update: {
          against_user_id?: string | null
          business_days_elapsed?: never
          category?: Database["public"]["Enums"]["complaint_category"] | null
          created_at?: string | null
          id?: string | null
          status?: Database["public"]["Enums"]["complaint_status"] | null
          submitted_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "complaints_against_user_id_fkey"
            columns: ["against_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "complaints_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      app_current_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      business_days_since: { Args: { p_start: string }; Returns: number }
      compute_fare: {
        Args: {
          p_distance_km: number
          p_passenger_id?: string
          p_seats?: number
        }
        Returns: number
      }
      is_admin: { Args: never; Returns: boolean }
      is_cluster_authorized: {
        Args: {
          p_barangay_cluster: Database["public"]["Enums"]["tricycle_cluster"]
          p_tricycle_cluster: Database["public"]["Enums"]["tricycle_cluster"]
        }
        Returns: boolean
      }
      is_pso: { Args: never; Returns: boolean }
      is_supervisor: { Args: never; Returns: boolean }
      notify_expiring_franchises: { Args: never; Returns: undefined }
    }
    Enums: {
      account_action_type:
        | "flag"
        | "unflag"
        | "suspend"
        | "reactivate"
        | "deactivate"
      account_status: "active" | "flagged" | "suspended" | "deactivated"
      complaint_category:
        | "fare"
        | "conduct"
        | "safety"
        | "low_rating"
        | "vehicle_condition"
        | "other"
      complaint_status:
        | "open"
        | "under_review"
        | "escalated"
        | "mediation_scheduled"
        | "resolved"
        | "dismissed"
      discount_category: "senior_citizen" | "pwd" | "student"
      document_type:
        | "drivers_license"
        | "or_cr"
        | "franchise_permit"
        | "tricycle_photo"
      notification_type:
        | "ride_status"
        | "verification_status"
        | "complaint_status"
        | "payment_status"
        | "discount_status"
        | "franchise_expiring"
      payment_method: "cash" | "gcash"
      payment_status: "pending" | "paid" | "failed" | "refunded"
      ride_status:
        | "pending"
        | "assigned"
        | "ongoing"
        | "completed"
        | "cancelled"
      tricycle_cluster: "red" | "white" | "apple_green" | "melting_pot"
      trip_status: "forming" | "active" | "completed" | "cancelled"
      user_role:
        | "passenger"
        | "driver"
        | "pso_staff"
        | "pso_supervisor"
        | "admin"
      verification_status: "unsubmitted" | "pending" | "approved" | "rejected"
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
      account_action_type: [
        "flag",
        "unflag",
        "suspend",
        "reactivate",
        "deactivate",
      ],
      account_status: ["active", "flagged", "suspended", "deactivated"],
      complaint_category: [
        "fare",
        "conduct",
        "safety",
        "low_rating",
        "vehicle_condition",
        "other",
      ],
      complaint_status: [
        "open",
        "under_review",
        "escalated",
        "mediation_scheduled",
        "resolved",
        "dismissed",
      ],
      discount_category: ["senior_citizen", "pwd", "student"],
      document_type: [
        "drivers_license",
        "or_cr",
        "franchise_permit",
        "tricycle_photo",
      ],
      notification_type: [
        "ride_status",
        "verification_status",
        "complaint_status",
        "payment_status",
        "discount_status",
        "franchise_expiring",
      ],
      payment_method: ["cash", "gcash"],
      payment_status: ["pending", "paid", "failed", "refunded"],
      ride_status: ["pending", "assigned", "ongoing", "completed", "cancelled"],
      tricycle_cluster: ["red", "white", "apple_green", "melting_pot"],
      trip_status: ["forming", "active", "completed", "cancelled"],
      user_role: [
        "passenger",
        "driver",
        "pso_staff",
        "pso_supervisor",
        "admin",
      ],
      verification_status: ["unsubmitted", "pending", "approved", "rejected"],
    },
  },
} as const
