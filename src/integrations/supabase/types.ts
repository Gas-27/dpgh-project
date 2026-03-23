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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      agent_package_prices: {
        Row: {
          agent_store_id: string
          created_at: string | null
          id: string
          package_id: string
          sell_price: number
        }
        Insert: {
          agent_store_id: string
          created_at?: string | null
          id?: string
          package_id: string
          sell_price?: number
        }
        Update: {
          agent_store_id?: string
          created_at?: string | null
          id?: string
          package_id?: string
          sell_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "agent_package_prices_agent_store_id_fkey"
            columns: ["agent_store_id"]
            isOneToOne: false
            referencedRelation: "agent_stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_package_prices_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "data_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_stores: {
        Row: {
          approved: boolean | null
          created_at: string | null
          id: string
          momo_name: string
          momo_network: string
          momo_number: string
          store_name: string
          support_number: string
          topup_reference: string | null
          user_id: string
          wallet_balance: number
          whatsapp_group: string | null
          whatsapp_number: string
        }
        Insert: {
          approved?: boolean | null
          created_at?: string | null
          id?: string
          momo_name: string
          momo_network: string
          momo_number: string
          store_name: string
          support_number: string
          topup_reference?: string | null
          user_id: string
          wallet_balance?: number
          whatsapp_group?: string | null
          whatsapp_number: string
        }
        Update: {
          approved?: boolean | null
          created_at?: string | null
          id?: string
          momo_name?: string
          momo_network?: string
          momo_number?: string
          store_name?: string
          support_number?: string
          topup_reference?: string | null
          user_id?: string
          wallet_balance?: number
          whatsapp_group?: string | null
          whatsapp_number?: string
        }
        Relationships: []
      }
      data_packages: {
        Row: {
          active: boolean | null
          agent_price: number
          created_at: string | null
          id: string
          network: string
          price: number
          size_gb: number
        }
        Insert: {
          active?: boolean | null
          agent_price?: number
          created_at?: string | null
          id?: string
          network: string
          price?: number
          size_gb: number
        }
        Update: {
          active?: boolean | null
          agent_price?: number
          created_at?: string | null
          id?: string
          network?: string
          price?: number
          size_gb?: number
        }
        Relationships: []
      }
      notification_dismissals: {
        Row: {
          dismissed_at: string
          id: string
          notification_id: string
          user_id: string
        }
        Insert: {
          dismissed_at?: string
          id?: string
          notification_id: string
          user_id: string
        }
        Update: {
          dismissed_at?: string
          id?: string
          notification_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_dismissals_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          message: string
          target_role: string
          title: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          message: string
          target_role: string
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          message?: string
          target_role?: string
          title?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          agent_store_id: string | null
          amount: number
          api_response: string | null
          created_at: string | null
          customer_number: string
          fulfillment_status: string
          id: string
          network: string
          package_id: string
          payment_method: string
          paystack_reference: string | null
          size_gb: number
          status: string
        }
        Insert: {
          agent_store_id?: string | null
          amount: number
          api_response?: string | null
          created_at?: string | null
          customer_number: string
          fulfillment_status?: string
          id?: string
          network: string
          package_id: string
          payment_method?: string
          paystack_reference?: string | null
          size_gb: number
          status?: string
        }
        Update: {
          agent_store_id?: string | null
          amount?: number
          api_response?: string | null
          created_at?: string | null
          customer_number?: string
          fulfillment_status?: string
          id?: string
          network?: string
          package_id?: string
          payment_method?: string
          paystack_reference?: string | null
          size_gb?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_agent_store_id_fkey"
            columns: ["agent_store_id"]
            isOneToOne: false
            referencedRelation: "agent_stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "data_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          full_name: string | null
          id: string
          phone: string | null
        }
        Insert: {
          created_at?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
        }
        Update: {
          created_at?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallet_topups: {
        Row: {
          admin_id: string | null
          agent_store_id: string
          amount: number
          created_at: string
          id: string
        }
        Insert: {
          admin_id?: string | null
          agent_store_id: string
          amount: number
          created_at?: string
          id?: string
        }
        Update: {
          admin_id?: string | null
          agent_store_id?: string
          amount?: number
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_topups_agent_store_id_fkey"
            columns: ["agent_store_id"]
            isOneToOne: false
            referencedRelation: "agent_stores"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "agent" | "user"
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
      app_role: ["admin", "agent", "user"],
    },
  },
} as const
