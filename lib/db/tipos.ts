// Tipos de la base de datos, GENERADOS con Supabase (generate_typescript_types). No editar a mano:
// tras una migración, regenerar y reemplazar este archivo.
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
      BodegaCentral: {
        Row: {
          Anulado: boolean
          Cantidad: number
          FechaCreacion: string
          FechaIngreso: string
          FechaModificacion: string
          Folio: number
          IdIngreso: number
          IdProducto: number
          IdProveedor: number
          IdUsuarioCreacion: number | null
          IdUsuarioModificacion: number | null
        }
        Insert: {
          Anulado?: boolean
          Cantidad: number
          FechaCreacion?: string
          FechaIngreso: string
          FechaModificacion?: string
          Folio: number
          IdIngreso?: never
          IdProducto: number
          IdProveedor: number
          IdUsuarioCreacion?: number | null
          IdUsuarioModificacion?: number | null
        }
        Update: {
          Anulado?: boolean
          Cantidad?: number
          FechaCreacion?: string
          FechaIngreso?: string
          FechaModificacion?: string
          Folio?: number
          IdIngreso?: never
          IdProducto?: number
          IdProveedor?: number
          IdUsuarioCreacion?: number | null
          IdUsuarioModificacion?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "BodegaCentral_IdProducto_fkey"
            columns: ["IdProducto"]
            isOneToOne: false
            referencedRelation: "Productos"
            referencedColumns: ["IdProducto"]
          },
          {
            foreignKeyName: "BodegaCentral_IdProveedor_Folio_fkey"
            columns: ["IdProveedor", "Folio"]
            isOneToOne: false
            referencedRelation: "Compras"
            referencedColumns: ["IdProveedor", "Folio"]
          },
          {
            foreignKeyName: "BodegaCentral_IdUsuarioCreacion_fkey"
            columns: ["IdUsuarioCreacion"]
            isOneToOne: false
            referencedRelation: "Usuarios"
            referencedColumns: ["IdUsuario"]
          },
          {
            foreignKeyName: "BodegaCentral_IdUsuarioModificacion_fkey"
            columns: ["IdUsuarioModificacion"]
            isOneToOne: false
            referencedRelation: "Usuarios"
            referencedColumns: ["IdUsuario"]
          },
        ]
      }
      Bodegas: {
        Row: {
          EsCentral: boolean
          FechaCreacion: string
          FechaModificacion: string
          IdBodega: number
          IdEstado: number
          IdUsuarioCreacion: number | null
          IdUsuarioModificacion: number | null
          NombreBodega: string
          Token: string
        }
        Insert: {
          EsCentral?: boolean
          FechaCreacion?: string
          FechaModificacion?: string
          IdBodega?: never
          IdEstado?: number
          IdUsuarioCreacion?: number | null
          IdUsuarioModificacion?: number | null
          NombreBodega: string
          Token?: string
        }
        Update: {
          EsCentral?: boolean
          FechaCreacion?: string
          FechaModificacion?: string
          IdBodega?: never
          IdEstado?: number
          IdUsuarioCreacion?: number | null
          IdUsuarioModificacion?: number | null
          NombreBodega?: string
          Token?: string
        }
        Relationships: [
          {
            foreignKeyName: "Bodegas_IdUsuarioCreacion_fkey"
            columns: ["IdUsuarioCreacion"]
            isOneToOne: false
            referencedRelation: "Usuarios"
            referencedColumns: ["IdUsuario"]
          },
          {
            foreignKeyName: "Bodegas_IdUsuarioModificacion_fkey"
            columns: ["IdUsuarioModificacion"]
            isOneToOne: false
            referencedRelation: "Usuarios"
            referencedColumns: ["IdUsuario"]
          },
        ]
      }
      Claves: {
        Row: {
          BloqueadoHasta: string | null
          DebeCambiar: boolean
          FechaRegistroCreacion: string
          FechaRegistroModificacion: string
          IdEstado: number
          IdUsuario: number
          IdUsuarioCreacion: number | null
          IdUsuarioModificacion: number | null
          IntentosFallidos: number
          Password: string
          VersionSesion: number
        }
        Insert: {
          BloqueadoHasta?: string | null
          DebeCambiar?: boolean
          FechaRegistroCreacion?: string
          FechaRegistroModificacion?: string
          IdEstado?: number
          IdUsuario: number
          IdUsuarioCreacion?: number | null
          IdUsuarioModificacion?: number | null
          IntentosFallidos?: number
          Password: string
          VersionSesion?: number
        }
        Update: {
          BloqueadoHasta?: string | null
          DebeCambiar?: boolean
          FechaRegistroCreacion?: string
          FechaRegistroModificacion?: string
          IdEstado?: number
          IdUsuario?: number
          IdUsuarioCreacion?: number | null
          IdUsuarioModificacion?: number | null
          IntentosFallidos?: number
          Password?: string
          VersionSesion?: number
        }
        Relationships: [
          {
            foreignKeyName: "Claves_IdUsuario_fkey"
            columns: ["IdUsuario"]
            isOneToOne: true
            referencedRelation: "Usuarios"
            referencedColumns: ["IdUsuario"]
          },
          {
            foreignKeyName: "Claves_IdUsuarioCreacion_fkey"
            columns: ["IdUsuarioCreacion"]
            isOneToOne: false
            referencedRelation: "Usuarios"
            referencedColumns: ["IdUsuario"]
          },
          {
            foreignKeyName: "Claves_IdUsuarioModificacion_fkey"
            columns: ["IdUsuarioModificacion"]
            isOneToOne: false
            referencedRelation: "Usuarios"
            referencedColumns: ["IdUsuario"]
          },
        ]
      }
      Compras: {
        Row: {
          FechaFactura: string
          FechaRecepcion: string
          FechaRegistroCreacion: string
          FechaRegistroModificacion: string
          Folio: number
          FormaPago: string
          GiroProveedor: string | null
          IdCompra: number
          IdEstado: number
          IdProveedor: number
          IdUsuarioCreacion: number | null
          IdUsuarioModificacion: number | null
          Iva: number
          MotivoAnulacion: string | null
          Neto: number
          NombreProveedor: string
          RutProveedor: string
          Token: string
          Total: number
        }
        Insert: {
          FechaFactura: string
          FechaRecepcion: string
          FechaRegistroCreacion?: string
          FechaRegistroModificacion?: string
          Folio: number
          FormaPago: string
          GiroProveedor?: string | null
          IdCompra?: never
          IdEstado?: number
          IdProveedor: number
          IdUsuarioCreacion?: number | null
          IdUsuarioModificacion?: number | null
          Iva: number
          MotivoAnulacion?: string | null
          Neto: number
          NombreProveedor: string
          RutProveedor: string
          Token?: string
          Total: number
        }
        Update: {
          FechaFactura?: string
          FechaRecepcion?: string
          FechaRegistroCreacion?: string
          FechaRegistroModificacion?: string
          Folio?: number
          FormaPago?: string
          GiroProveedor?: string | null
          IdCompra?: never
          IdEstado?: number
          IdProveedor?: number
          IdUsuarioCreacion?: number | null
          IdUsuarioModificacion?: number | null
          Iva?: number
          MotivoAnulacion?: string | null
          Neto?: number
          NombreProveedor?: string
          RutProveedor?: string
          Token?: string
          Total?: number
        }
        Relationships: [
          {
            foreignKeyName: "Compras_FormaPago_fkey"
            columns: ["FormaPago"]
            isOneToOne: false
            referencedRelation: "FormasPago"
            referencedColumns: ["Codigo"]
          },
          {
            foreignKeyName: "Compras_IdProveedor_fkey"
            columns: ["IdProveedor"]
            isOneToOne: false
            referencedRelation: "Proveedores"
            referencedColumns: ["IdProveedor"]
          },
          {
            foreignKeyName: "Compras_IdUsuarioCreacion_fkey"
            columns: ["IdUsuarioCreacion"]
            isOneToOne: false
            referencedRelation: "Usuarios"
            referencedColumns: ["IdUsuario"]
          },
          {
            foreignKeyName: "Compras_IdUsuarioModificacion_fkey"
            columns: ["IdUsuarioModificacion"]
            isOneToOne: false
            referencedRelation: "Usuarios"
            referencedColumns: ["IdUsuario"]
          },
        ]
      }
      ComprasDetalle: {
        Row: {
          Cantidad: number
          Folio: number
          IdDetalle: number
          IdProducto: number
          IdProveedor: number
          Precio: number
          Total: number
          UnidadMedida: string
        }
        Insert: {
          Cantidad: number
          Folio: number
          IdDetalle?: never
          IdProducto: number
          IdProveedor: number
          Precio: number
          Total: number
          UnidadMedida: string
        }
        Update: {
          Cantidad?: number
          Folio?: number
          IdDetalle?: never
          IdProducto?: number
          IdProveedor?: number
          Precio?: number
          Total?: number
          UnidadMedida?: string
        }
        Relationships: [
          {
            foreignKeyName: "ComprasDetalle_IdProducto_fkey"
            columns: ["IdProducto"]
            isOneToOne: false
            referencedRelation: "Productos"
            referencedColumns: ["IdProducto"]
          },
          {
            foreignKeyName: "ComprasDetalle_IdProveedor_Folio_fkey"
            columns: ["IdProveedor", "Folio"]
            isOneToOne: false
            referencedRelation: "Compras"
            referencedColumns: ["IdProveedor", "Folio"]
          },
          {
            foreignKeyName: "ComprasDetalle_UnidadMedida_fkey"
            columns: ["UnidadMedida"]
            isOneToOne: false
            referencedRelation: "UnidadesMedida"
            referencedColumns: ["Codigo"]
          },
        ]
      }
      Comunas: {
        Row: {
          Codigo: string
          CodigoProvincia: string
          FechaRegistroCreacion: string
          FechaRegistroModificacion: string
          IdComuna: number
          IdEstado: number
          IdUsuarioCreacion: number | null
          IdUsuarioModificacion: number | null
          Nombre: string
        }
        Insert: {
          Codigo: string
          CodigoProvincia: string
          FechaRegistroCreacion?: string
          FechaRegistroModificacion?: string
          IdComuna?: never
          IdEstado?: number
          IdUsuarioCreacion?: number | null
          IdUsuarioModificacion?: number | null
          Nombre: string
        }
        Update: {
          Codigo?: string
          CodigoProvincia?: string
          FechaRegistroCreacion?: string
          FechaRegistroModificacion?: string
          IdComuna?: never
          IdEstado?: number
          IdUsuarioCreacion?: number | null
          IdUsuarioModificacion?: number | null
          Nombre?: string
        }
        Relationships: [
          {
            foreignKeyName: "Comunas_CodigoProvincia_fkey"
            columns: ["CodigoProvincia"]
            isOneToOne: false
            referencedRelation: "Provincias"
            referencedColumns: ["Codigo"]
          },
          {
            foreignKeyName: "Comunas_IdUsuarioCreacion_fkey"
            columns: ["IdUsuarioCreacion"]
            isOneToOne: false
            referencedRelation: "Usuarios"
            referencedColumns: ["IdUsuario"]
          },
          {
            foreignKeyName: "Comunas_IdUsuarioModificacion_fkey"
            columns: ["IdUsuarioModificacion"]
            isOneToOne: false
            referencedRelation: "Usuarios"
            referencedColumns: ["IdUsuario"]
          },
        ]
      }
      CorreosPendientes: {
        Row: {
          Asunto: string
          ClaveUnica: string | null
          Estado: number
          FechaEnvio: string | null
          FechaRegistroCreacion: string
          Html: string
          IdCorreo: number
          Intentos: number
          Para: string[]
          ProximoIntento: string
          UltimoError: string | null
        }
        Insert: {
          Asunto: string
          ClaveUnica?: string | null
          Estado?: number
          FechaEnvio?: string | null
          FechaRegistroCreacion?: string
          Html: string
          IdCorreo?: never
          Intentos?: number
          Para: string[]
          ProximoIntento?: string
          UltimoError?: string | null
        }
        Update: {
          Asunto?: string
          ClaveUnica?: string | null
          Estado?: number
          FechaEnvio?: string | null
          FechaRegistroCreacion?: string
          Html?: string
          IdCorreo?: never
          Intentos?: number
          Para?: string[]
          ProximoIntento?: string
          UltimoError?: string | null
        }
        Relationships: []
      }
      FormasPago: {
        Row: {
          Codigo: string
          FechaRegistroCreacion: string
          FechaRegistroModificacion: string
          IdEstado: number
          IdFormaPago: number
          IdUsuarioCreacion: number | null
          IdUsuarioModificacion: number | null
          Nombre: string
        }
        Insert: {
          Codigo: string
          FechaRegistroCreacion?: string
          FechaRegistroModificacion?: string
          IdEstado?: number
          IdFormaPago?: never
          IdUsuarioCreacion?: number | null
          IdUsuarioModificacion?: number | null
          Nombre: string
        }
        Update: {
          Codigo?: string
          FechaRegistroCreacion?: string
          FechaRegistroModificacion?: string
          IdEstado?: number
          IdFormaPago?: never
          IdUsuarioCreacion?: number | null
          IdUsuarioModificacion?: number | null
          Nombre?: string
        }
        Relationships: [
          {
            foreignKeyName: "FormasPago_IdUsuarioCreacion_fkey"
            columns: ["IdUsuarioCreacion"]
            isOneToOne: false
            referencedRelation: "Usuarios"
            referencedColumns: ["IdUsuario"]
          },
          {
            foreignKeyName: "FormasPago_IdUsuarioModificacion_fkey"
            columns: ["IdUsuarioModificacion"]
            isOneToOne: false
            referencedRelation: "Usuarios"
            referencedColumns: ["IdUsuario"]
          },
        ]
      }
      Formatos: {
        Row: {
          Codigo: string
          FechaRegistroCreacion: string
          FechaRegistroModificacion: string
          IdEstado: number
          IdFormato: number
          IdUsuarioCreacion: number | null
          IdUsuarioModificacion: number | null
          Nombre: string
        }
        Insert: {
          Codigo: string
          FechaRegistroCreacion?: string
          FechaRegistroModificacion?: string
          IdEstado?: number
          IdFormato?: never
          IdUsuarioCreacion?: number | null
          IdUsuarioModificacion?: number | null
          Nombre: string
        }
        Update: {
          Codigo?: string
          FechaRegistroCreacion?: string
          FechaRegistroModificacion?: string
          IdEstado?: number
          IdFormato?: never
          IdUsuarioCreacion?: number | null
          IdUsuarioModificacion?: number | null
          Nombre?: string
        }
        Relationships: [
          {
            foreignKeyName: "Formatos_IdUsuarioCreacion_fkey"
            columns: ["IdUsuarioCreacion"]
            isOneToOne: false
            referencedRelation: "Usuarios"
            referencedColumns: ["IdUsuario"]
          },
          {
            foreignKeyName: "Formatos_IdUsuarioModificacion_fkey"
            columns: ["IdUsuarioModificacion"]
            isOneToOne: false
            referencedRelation: "Usuarios"
            referencedColumns: ["IdUsuario"]
          },
        ]
      }
      HistorialClaves: {
        Row: {
          FechaRegistroCreacion: string
          FechaRegistroModificacion: string
          IdHistorial: number
          IdUsuario: number
          IdUsuarioCreacion: number | null
          IdUsuarioModificacion: number | null
          Password: string
        }
        Insert: {
          FechaRegistroCreacion?: string
          FechaRegistroModificacion?: string
          IdHistorial?: never
          IdUsuario: number
          IdUsuarioCreacion?: number | null
          IdUsuarioModificacion?: number | null
          Password: string
        }
        Update: {
          FechaRegistroCreacion?: string
          FechaRegistroModificacion?: string
          IdHistorial?: never
          IdUsuario?: number
          IdUsuarioCreacion?: number | null
          IdUsuarioModificacion?: number | null
          Password?: string
        }
        Relationships: [
          {
            foreignKeyName: "HistorialClaves_IdUsuario_fkey"
            columns: ["IdUsuario"]
            isOneToOne: false
            referencedRelation: "Usuarios"
            referencedColumns: ["IdUsuario"]
          },
          {
            foreignKeyName: "HistorialClaves_IdUsuarioCreacion_fkey"
            columns: ["IdUsuarioCreacion"]
            isOneToOne: false
            referencedRelation: "Usuarios"
            referencedColumns: ["IdUsuario"]
          },
          {
            foreignKeyName: "HistorialClaves_IdUsuarioModificacion_fkey"
            columns: ["IdUsuarioModificacion"]
            isOneToOne: false
            referencedRelation: "Usuarios"
            referencedColumns: ["IdUsuario"]
          },
        ]
      }
      HistorialPreciosProducto: {
        Row: {
          Anulada: boolean
          CostoBaseAnterior: number | null
          CostoBaseNuevo: number | null
          FechaRegistro: string
          IdCompra: number
          IdHistorial: number
          IdProducto: number
          IdUsuario: number | null
          Origen: string
          Precio: number | null
          UnidadMedida: string | null
        }
        Insert: {
          Anulada?: boolean
          CostoBaseAnterior?: number | null
          CostoBaseNuevo?: number | null
          FechaRegistro?: string
          IdCompra: number
          IdHistorial?: never
          IdProducto: number
          IdUsuario?: number | null
          Origen: string
          Precio?: number | null
          UnidadMedida?: string | null
        }
        Update: {
          Anulada?: boolean
          CostoBaseAnterior?: number | null
          CostoBaseNuevo?: number | null
          FechaRegistro?: string
          IdCompra?: number
          IdHistorial?: never
          IdProducto?: number
          IdUsuario?: number | null
          Origen?: string
          Precio?: number | null
          UnidadMedida?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "HistorialPreciosProducto_IdCompra_fkey"
            columns: ["IdCompra"]
            isOneToOne: false
            referencedRelation: "Compras"
            referencedColumns: ["IdCompra"]
          },
          {
            foreignKeyName: "HistorialPreciosProducto_IdProducto_fkey"
            columns: ["IdProducto"]
            isOneToOne: false
            referencedRelation: "Productos"
            referencedColumns: ["IdProducto"]
          },
          {
            foreignKeyName: "HistorialPreciosProducto_IdUsuario_fkey"
            columns: ["IdUsuario"]
            isOneToOne: false
            referencedRelation: "Usuarios"
            referencedColumns: ["IdUsuario"]
          },
          {
            foreignKeyName: "HistorialPreciosProducto_UnidadMedida_fkey"
            columns: ["UnidadMedida"]
            isOneToOne: false
            referencedRelation: "UnidadesMedida"
            referencedColumns: ["Codigo"]
          },
        ]
      }
      HistorialSolicitudes: {
        Row: {
          EstadoSolicitud: number
          FechaCreacion: string
          FechaIngreso: string
          FechaModificacion: string
          IdHistorial: number
          IdSolicitud: number
          IdUsuarioCreacion: number | null
          IdUsuarioModificacion: number | null
        }
        Insert: {
          EstadoSolicitud: number
          FechaCreacion?: string
          FechaIngreso?: string
          FechaModificacion?: string
          IdHistorial?: never
          IdSolicitud: number
          IdUsuarioCreacion?: number | null
          IdUsuarioModificacion?: number | null
        }
        Update: {
          EstadoSolicitud?: number
          FechaCreacion?: string
          FechaIngreso?: string
          FechaModificacion?: string
          IdHistorial?: never
          IdSolicitud?: number
          IdUsuarioCreacion?: number | null
          IdUsuarioModificacion?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "HistorialSolicitudes_IdSolicitud_fkey"
            columns: ["IdSolicitud"]
            isOneToOne: false
            referencedRelation: "Solicitudes"
            referencedColumns: ["IdSolicitud"]
          },
          {
            foreignKeyName: "HistorialSolicitudes_IdUsuarioCreacion_fkey"
            columns: ["IdUsuarioCreacion"]
            isOneToOne: false
            referencedRelation: "Usuarios"
            referencedColumns: ["IdUsuario"]
          },
          {
            foreignKeyName: "HistorialSolicitudes_IdUsuarioModificacion_fkey"
            columns: ["IdUsuarioModificacion"]
            isOneToOne: false
            referencedRelation: "Usuarios"
            referencedColumns: ["IdUsuario"]
          },
        ]
      }
      IntentosLogin: {
        Row: {
          Clave: string
          Desde: string
          N: number
        }
        Insert: {
          Clave: string
          Desde?: string
          N: number
        }
        Update: {
          Clave?: string
          Desde?: string
          N?: number
        }
        Relationships: []
      }
      MovimientosBodega: {
        Row: {
          Cantidad: number
          FechaCreacion: string
          FechaModificacion: string
          FechaMovimiento: string
          IdBodegaDestino: number
          IdBodegaOrigen: number
          IdMovimiento: number
          IdProducto: number
          IdSolicitud: number | null
          IdUsuarioCreacion: number | null
          IdUsuarioModificacion: number | null
        }
        Insert: {
          Cantidad: number
          FechaCreacion?: string
          FechaModificacion?: string
          FechaMovimiento?: string
          IdBodegaDestino: number
          IdBodegaOrigen: number
          IdMovimiento?: never
          IdProducto: number
          IdSolicitud?: number | null
          IdUsuarioCreacion?: number | null
          IdUsuarioModificacion?: number | null
        }
        Update: {
          Cantidad?: number
          FechaCreacion?: string
          FechaModificacion?: string
          FechaMovimiento?: string
          IdBodegaDestino?: number
          IdBodegaOrigen?: number
          IdMovimiento?: never
          IdProducto?: number
          IdSolicitud?: number | null
          IdUsuarioCreacion?: number | null
          IdUsuarioModificacion?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "MovimientosBodega_IdBodegaDestino_fkey"
            columns: ["IdBodegaDestino"]
            isOneToOne: false
            referencedRelation: "Bodegas"
            referencedColumns: ["IdBodega"]
          },
          {
            foreignKeyName: "MovimientosBodega_IdBodegaOrigen_fkey"
            columns: ["IdBodegaOrigen"]
            isOneToOne: false
            referencedRelation: "Bodegas"
            referencedColumns: ["IdBodega"]
          },
          {
            foreignKeyName: "MovimientosBodega_IdProducto_fkey"
            columns: ["IdProducto"]
            isOneToOne: false
            referencedRelation: "Productos"
            referencedColumns: ["IdProducto"]
          },
          {
            foreignKeyName: "MovimientosBodega_IdSolicitud_fkey"
            columns: ["IdSolicitud"]
            isOneToOne: false
            referencedRelation: "Solicitudes"
            referencedColumns: ["IdSolicitud"]
          },
          {
            foreignKeyName: "MovimientosBodega_IdUsuarioCreacion_fkey"
            columns: ["IdUsuarioCreacion"]
            isOneToOne: false
            referencedRelation: "Usuarios"
            referencedColumns: ["IdUsuario"]
          },
          {
            foreignKeyName: "MovimientosBodega_IdUsuarioModificacion_fkey"
            columns: ["IdUsuarioModificacion"]
            isOneToOne: false
            referencedRelation: "Usuarios"
            referencedColumns: ["IdUsuario"]
          },
        ]
      }
      Permisos: {
        Row: {
          Codigo: string
          Descripcion: string
          Modulo: string
          Orden: number
        }
        Insert: {
          Codigo: string
          Descripcion: string
          Modulo: string
          Orden: number
        }
        Update: {
          Codigo?: string
          Descripcion?: string
          Modulo?: string
          Orden?: number
        }
        Relationships: []
      }
      Productos: {
        Row: {
          Codigo: string | null
          CostoUnitarioBase: number | null
          FechaRegistroCreacion: string
          FechaRegistroModificacion: string
          Formato: string
          IdEstado: number
          IdProducto: number
          IdUsuarioCreacion: number | null
          IdUsuarioModificacion: number | null
          Nombre: string
          StockCritico: number
          StockMinimo: number
          UnidadBase: string
          Token: string
        }
        Insert: {
          Codigo?: string | null
          CostoUnitarioBase?: number | null
          FechaRegistroCreacion?: string
          FechaRegistroModificacion?: string
          Formato: string
          IdEstado?: number
          IdProducto?: never
          IdUsuarioCreacion?: number | null
          IdUsuarioModificacion?: number | null
          Nombre: string
          StockCritico?: number
          StockMinimo?: number
          UnidadBase: string
          Token?: string
        }
        Update: {
          Codigo?: string | null
          CostoUnitarioBase?: number | null
          FechaRegistroCreacion?: string
          FechaRegistroModificacion?: string
          Formato?: string
          IdEstado?: number
          IdProducto?: never
          IdUsuarioCreacion?: number | null
          IdUsuarioModificacion?: number | null
          Nombre?: string
          StockCritico?: number
          StockMinimo?: number
          UnidadBase?: string
          Token?: string
        }
        Relationships: [
          {
            foreignKeyName: "Productos_Formato_fkey"
            columns: ["Formato"]
            isOneToOne: false
            referencedRelation: "Formatos"
            referencedColumns: ["Codigo"]
          },
          {
            foreignKeyName: "Productos_IdUsuarioCreacion_fkey"
            columns: ["IdUsuarioCreacion"]
            isOneToOne: false
            referencedRelation: "Usuarios"
            referencedColumns: ["IdUsuario"]
          },
          {
            foreignKeyName: "Productos_IdUsuarioModificacion_fkey"
            columns: ["IdUsuarioModificacion"]
            isOneToOne: false
            referencedRelation: "Usuarios"
            referencedColumns: ["IdUsuario"]
          },
          {
            foreignKeyName: "Productos_UnidadBase_fkey"
            columns: ["UnidadBase"]
            isOneToOne: false
            referencedRelation: "UnidadesMedida"
            referencedColumns: ["Codigo"]
          },
        ]
      }
      Proveedores: {
        Row: {
          Ciudad: string | null
          Comuna: string | null
          Correo: string | null
          Direccion: string | null
          FechaRegistro: string
          FechaRegistroModificacion: string
          Giro: string | null
          IdEstado: number
          IdProveedor: number
          IdUsuario: number | null
          NombreRepresentanteLegal: string | null
          RazonSocial: string
          Region: string | null
          Rut: string
          RutRepresentanteLegal: string | null
          Telefono: string | null
          Token: string
        }
        Insert: {
          Ciudad?: string | null
          Comuna?: string | null
          Correo?: string | null
          Direccion?: string | null
          FechaRegistro?: string
          FechaRegistroModificacion?: string
          Giro?: string | null
          IdEstado?: number
          IdProveedor?: never
          IdUsuario?: number | null
          NombreRepresentanteLegal?: string | null
          RazonSocial: string
          Region?: string | null
          Rut: string
          RutRepresentanteLegal?: string | null
          Telefono?: string | null
          Token?: string
        }
        Update: {
          Ciudad?: string | null
          Comuna?: string | null
          Correo?: string | null
          Direccion?: string | null
          FechaRegistro?: string
          FechaRegistroModificacion?: string
          Giro?: string | null
          IdEstado?: number
          IdProveedor?: never
          IdUsuario?: number | null
          NombreRepresentanteLegal?: string | null
          RazonSocial?: string
          Region?: string | null
          Rut?: string
          RutRepresentanteLegal?: string | null
          Telefono?: string | null
          Token?: string
        }
        Relationships: [
          {
            foreignKeyName: "Proveedores_Ciudad_fkey"
            columns: ["Ciudad"]
            isOneToOne: false
            referencedRelation: "Provincias"
            referencedColumns: ["Codigo"]
          },
          {
            foreignKeyName: "Proveedores_Comuna_fkey"
            columns: ["Comuna"]
            isOneToOne: false
            referencedRelation: "Comunas"
            referencedColumns: ["Codigo"]
          },
          {
            foreignKeyName: "Proveedores_IdUsuario_fkey"
            columns: ["IdUsuario"]
            isOneToOne: false
            referencedRelation: "Usuarios"
            referencedColumns: ["IdUsuario"]
          },
          {
            foreignKeyName: "Proveedores_Region_fkey"
            columns: ["Region"]
            isOneToOne: false
            referencedRelation: "Regiones"
            referencedColumns: ["Codigo"]
          },
        ]
      }
      ProveedoresSucursales: {
        Row: {
          Ciudad: string | null
          Comuna: string | null
          Correo: string | null
          Direccion: string | null
          EncargadoSucursal: string | null
          FechaRegistro: string
          FechaRegistroModificacion: string
          IdEstado: number
          IdProveedor: number
          IdSucursal: number
          IdUsuario: number | null
          Region: string | null
          Telefono: string | null
          Token: string
        }
        Insert: {
          Ciudad?: string | null
          Comuna?: string | null
          Correo?: string | null
          Direccion?: string | null
          EncargadoSucursal?: string | null
          FechaRegistro?: string
          FechaRegistroModificacion?: string
          IdEstado?: number
          IdProveedor: number
          IdSucursal?: never
          IdUsuario?: number | null
          Region?: string | null
          Telefono?: string | null
          Token?: string
        }
        Update: {
          Ciudad?: string | null
          Comuna?: string | null
          Correo?: string | null
          Direccion?: string | null
          EncargadoSucursal?: string | null
          FechaRegistro?: string
          FechaRegistroModificacion?: string
          IdEstado?: number
          IdProveedor?: number
          IdSucursal?: never
          IdUsuario?: number | null
          Region?: string | null
          Telefono?: string | null
          Token?: string
        }
        Relationships: [
          {
            foreignKeyName: "ProveedoresSucursales_Ciudad_fkey"
            columns: ["Ciudad"]
            isOneToOne: false
            referencedRelation: "Provincias"
            referencedColumns: ["Codigo"]
          },
          {
            foreignKeyName: "ProveedoresSucursales_Comuna_fkey"
            columns: ["Comuna"]
            isOneToOne: false
            referencedRelation: "Comunas"
            referencedColumns: ["Codigo"]
          },
          {
            foreignKeyName: "ProveedoresSucursales_IdProveedor_fkey"
            columns: ["IdProveedor"]
            isOneToOne: false
            referencedRelation: "Proveedores"
            referencedColumns: ["IdProveedor"]
          },
          {
            foreignKeyName: "ProveedoresSucursales_IdUsuario_fkey"
            columns: ["IdUsuario"]
            isOneToOne: false
            referencedRelation: "Usuarios"
            referencedColumns: ["IdUsuario"]
          },
          {
            foreignKeyName: "ProveedoresSucursales_Region_fkey"
            columns: ["Region"]
            isOneToOne: false
            referencedRelation: "Regiones"
            referencedColumns: ["Codigo"]
          },
        ]
      }
      ProveedoresVendedores: {
        Row: {
          Apellidos: string
          Correo: string | null
          FechaRegistro: string
          FechaRegistroModificacion: string
          IdEstado: number
          IdProveedor: number
          IdUsuario: number | null
          IdVendedor: number
          Nombres: string
          Rut: string
          Telefono: string | null
          Token: string
        }
        Insert: {
          Apellidos: string
          Correo?: string | null
          FechaRegistro?: string
          FechaRegistroModificacion?: string
          IdEstado?: number
          IdProveedor: number
          IdUsuario?: number | null
          IdVendedor?: never
          Nombres: string
          Rut: string
          Telefono?: string | null
          Token?: string
        }
        Update: {
          Apellidos?: string
          Correo?: string | null
          FechaRegistro?: string
          FechaRegistroModificacion?: string
          IdEstado?: number
          IdProveedor?: number
          IdUsuario?: number | null
          IdVendedor?: never
          Nombres?: string
          Rut?: string
          Telefono?: string | null
          Token?: string
        }
        Relationships: [
          {
            foreignKeyName: "ProveedoresVendedores_IdProveedor_fkey"
            columns: ["IdProveedor"]
            isOneToOne: false
            referencedRelation: "Proveedores"
            referencedColumns: ["IdProveedor"]
          },
          {
            foreignKeyName: "ProveedoresVendedores_IdUsuario_fkey"
            columns: ["IdUsuario"]
            isOneToOne: false
            referencedRelation: "Usuarios"
            referencedColumns: ["IdUsuario"]
          },
        ]
      }
      Provincias: {
        Row: {
          Codigo: string
          CodigoRegion: string
          FechaRegistroCreacion: string
          FechaRegistroModificacion: string
          IdEstado: number
          IdProvincia: number
          IdUsuarioCreacion: number | null
          IdUsuarioModificacion: number | null
          Nombre: string
        }
        Insert: {
          Codigo: string
          CodigoRegion: string
          FechaRegistroCreacion?: string
          FechaRegistroModificacion?: string
          IdEstado?: number
          IdProvincia?: never
          IdUsuarioCreacion?: number | null
          IdUsuarioModificacion?: number | null
          Nombre: string
        }
        Update: {
          Codigo?: string
          CodigoRegion?: string
          FechaRegistroCreacion?: string
          FechaRegistroModificacion?: string
          IdEstado?: number
          IdProvincia?: never
          IdUsuarioCreacion?: number | null
          IdUsuarioModificacion?: number | null
          Nombre?: string
        }
        Relationships: [
          {
            foreignKeyName: "Provincias_CodigoRegion_fkey"
            columns: ["CodigoRegion"]
            isOneToOne: false
            referencedRelation: "Regiones"
            referencedColumns: ["Codigo"]
          },
          {
            foreignKeyName: "Provincias_IdUsuarioCreacion_fkey"
            columns: ["IdUsuarioCreacion"]
            isOneToOne: false
            referencedRelation: "Usuarios"
            referencedColumns: ["IdUsuario"]
          },
          {
            foreignKeyName: "Provincias_IdUsuarioModificacion_fkey"
            columns: ["IdUsuarioModificacion"]
            isOneToOne: false
            referencedRelation: "Usuarios"
            referencedColumns: ["IdUsuario"]
          },
        ]
      }
      RecetaDetalles: {
        Row: {
          Cantidad: number
          IdDetalle: number
          IdProducto: number | null
          IdReceta: number
          IdSubReceta: number | null
          PorcentajeMerma: number
          PorcionNeta: number
          UnidadMedida: string
        }
        Insert: {
          Cantidad?: number
          IdDetalle?: never
          IdProducto?: number | null
          IdReceta: number
          IdSubReceta?: number | null
          PorcentajeMerma?: number
          PorcionNeta: number
          UnidadMedida: string
        }
        Update: {
          Cantidad?: number
          IdDetalle?: never
          IdProducto?: number | null
          IdReceta?: number
          IdSubReceta?: number | null
          PorcentajeMerma?: number
          PorcionNeta?: number
          UnidadMedida?: string
        }
        Relationships: [
          {
            foreignKeyName: "RecetaDetalles_IdProducto_fkey"
            columns: ["IdProducto"]
            isOneToOne: false
            referencedRelation: "Productos"
            referencedColumns: ["IdProducto"]
          },
          {
            foreignKeyName: "RecetaDetalles_IdReceta_fkey"
            columns: ["IdReceta"]
            isOneToOne: false
            referencedRelation: "Recetas"
            referencedColumns: ["IdReceta"]
          },
          {
            foreignKeyName: "RecetaDetalles_IdSubReceta_fkey"
            columns: ["IdSubReceta"]
            isOneToOne: false
            referencedRelation: "Recetas"
            referencedColumns: ["IdReceta"]
          },
          {
            foreignKeyName: "RecetaDetalles_UnidadMedida_fkey"
            columns: ["UnidadMedida"]
            isOneToOne: false
            referencedRelation: "UnidadesMedida"
            referencedColumns: ["Codigo"]
          },
        ]
      }
      Recetas: {
        Row: {
          CodigoReceta: string | null
          FechaRegistroCreacion: string
          FechaRegistroModificacion: string
          IdEstado: number
          IdReceta: number
          IdUsuarioCreacion: number | null
          IdUsuarioModificacion: number | null
          Nombre: string
          RendimientoCantidad: number | null
          RendimientoPorciones: number
          RendimientoUnidad: string | null
          Token: string
        }
        Insert: {
          CodigoReceta?: string | null
          FechaRegistroCreacion?: string
          FechaRegistroModificacion?: string
          IdEstado?: number
          IdReceta?: never
          IdUsuarioCreacion?: number | null
          IdUsuarioModificacion?: number | null
          Nombre: string
          RendimientoCantidad?: number | null
          RendimientoPorciones?: number
          RendimientoUnidad?: string | null
          Token?: string
        }
        Update: {
          CodigoReceta?: string | null
          FechaRegistroCreacion?: string
          FechaRegistroModificacion?: string
          IdEstado?: number
          IdReceta?: never
          IdUsuarioCreacion?: number | null
          IdUsuarioModificacion?: number | null
          Nombre?: string
          RendimientoCantidad?: number | null
          RendimientoPorciones?: number
          RendimientoUnidad?: string | null
          Token?: string
        }
        Relationships: [
          {
            foreignKeyName: "Recetas_IdUsuarioCreacion_fkey"
            columns: ["IdUsuarioCreacion"]
            isOneToOne: false
            referencedRelation: "Usuarios"
            referencedColumns: ["IdUsuario"]
          },
          {
            foreignKeyName: "Recetas_IdUsuarioModificacion_fkey"
            columns: ["IdUsuarioModificacion"]
            isOneToOne: false
            referencedRelation: "Usuarios"
            referencedColumns: ["IdUsuario"]
          },
          {
            foreignKeyName: "Recetas_RendimientoUnidad_fkey"
            columns: ["RendimientoUnidad"]
            isOneToOne: false
            referencedRelation: "UnidadesMedida"
            referencedColumns: ["Codigo"]
          },
        ]
      }
      Regiones: {
        Row: {
          Codigo: string
          FechaRegistroCreacion: string
          FechaRegistroModificacion: string
          IdEstado: number
          IdRegion: number
          IdUsuarioCreacion: number | null
          IdUsuarioModificacion: number | null
          Nombre: string
        }
        Insert: {
          Codigo: string
          FechaRegistroCreacion?: string
          FechaRegistroModificacion?: string
          IdEstado?: number
          IdRegion?: never
          IdUsuarioCreacion?: number | null
          IdUsuarioModificacion?: number | null
          Nombre: string
        }
        Update: {
          Codigo?: string
          FechaRegistroCreacion?: string
          FechaRegistroModificacion?: string
          IdEstado?: number
          IdRegion?: never
          IdUsuarioCreacion?: number | null
          IdUsuarioModificacion?: number | null
          Nombre?: string
        }
        Relationships: [
          {
            foreignKeyName: "Regiones_IdUsuarioCreacion_fkey"
            columns: ["IdUsuarioCreacion"]
            isOneToOne: false
            referencedRelation: "Usuarios"
            referencedColumns: ["IdUsuario"]
          },
          {
            foreignKeyName: "Regiones_IdUsuarioModificacion_fkey"
            columns: ["IdUsuarioModificacion"]
            isOneToOne: false
            referencedRelation: "Usuarios"
            referencedColumns: ["IdUsuario"]
          },
        ]
      }
      Roles: {
        Row: {
          DetalleRol: string | null
          EsBase: boolean
          FechaRegistroCreacion: string
          FechaRegistroModificacion: string
          IdEstado: number
          IdRol: number
          IdUsuarioCreacion: number | null
          IdUsuarioModificacion: number | null
          NombreRol: string
          Token: string
        }
        Insert: {
          DetalleRol?: string | null
          EsBase?: boolean
          FechaRegistroCreacion?: string
          FechaRegistroModificacion?: string
          IdEstado?: number
          IdRol?: never
          IdUsuarioCreacion?: number | null
          IdUsuarioModificacion?: number | null
          NombreRol: string
          Token?: string
        }
        Update: {
          DetalleRol?: string | null
          EsBase?: boolean
          FechaRegistroCreacion?: string
          FechaRegistroModificacion?: string
          IdEstado?: number
          IdRol?: never
          IdUsuarioCreacion?: number | null
          IdUsuarioModificacion?: number | null
          NombreRol?: string
          Token?: string
        }
        Relationships: [
          {
            foreignKeyName: "Roles_IdUsuarioCreacion_fkey"
            columns: ["IdUsuarioCreacion"]
            isOneToOne: false
            referencedRelation: "Usuarios"
            referencedColumns: ["IdUsuario"]
          },
          {
            foreignKeyName: "Roles_IdUsuarioModificacion_fkey"
            columns: ["IdUsuarioModificacion"]
            isOneToOne: false
            referencedRelation: "Usuarios"
            referencedColumns: ["IdUsuario"]
          },
        ]
      }
      RolesPermisos: {
        Row: {
          FechaRegistroCreacion: string
          FechaRegistroModificacion: string
          IdRol: number
          IdUsuarioCreacion: number | null
          IdUsuarioModificacion: number | null
          Permiso: string
        }
        Insert: {
          FechaRegistroCreacion?: string
          FechaRegistroModificacion?: string
          IdRol: number
          IdUsuarioCreacion?: number | null
          IdUsuarioModificacion?: number | null
          Permiso: string
        }
        Update: {
          FechaRegistroCreacion?: string
          FechaRegistroModificacion?: string
          IdRol?: number
          IdUsuarioCreacion?: number | null
          IdUsuarioModificacion?: number | null
          Permiso?: string
        }
        Relationships: [
          {
            foreignKeyName: "RolesPermisos_IdRol_fkey"
            columns: ["IdRol"]
            isOneToOne: false
            referencedRelation: "Roles"
            referencedColumns: ["IdRol"]
          },
          {
            foreignKeyName: "RolesPermisos_IdUsuarioCreacion_fkey"
            columns: ["IdUsuarioCreacion"]
            isOneToOne: false
            referencedRelation: "Usuarios"
            referencedColumns: ["IdUsuario"]
          },
          {
            foreignKeyName: "RolesPermisos_IdUsuarioModificacion_fkey"
            columns: ["IdUsuarioModificacion"]
            isOneToOne: false
            referencedRelation: "Usuarios"
            referencedColumns: ["IdUsuario"]
          },
          {
            foreignKeyName: "RolesPermisos_Permiso_fkey"
            columns: ["Permiso"]
            isOneToOne: false
            referencedRelation: "Permisos"
            referencedColumns: ["Codigo"]
          },
        ]
      }
      Solicitudes: {
        Row: {
          EstadoSolicitud: number
          FechaAprobacion: string | null
          FechaRegistroModificacion: string
          FechaSolicitud: string
          IdBodegaDestino: number
          IdSolicitud: number
          IdUsuarioAprobador: number | null
          IdUsuarioSolicitante: number
          NumeroSolicitud: number
          Token: string
        }
        Insert: {
          EstadoSolicitud?: number
          FechaAprobacion?: string | null
          FechaRegistroModificacion?: string
          FechaSolicitud?: string
          IdBodegaDestino: number
          IdSolicitud?: never
          IdUsuarioAprobador?: number | null
          IdUsuarioSolicitante: number
          NumeroSolicitud?: number
          Token?: string
        }
        Update: {
          EstadoSolicitud?: number
          FechaAprobacion?: string | null
          FechaRegistroModificacion?: string
          FechaSolicitud?: string
          IdBodegaDestino?: number
          IdSolicitud?: never
          IdUsuarioAprobador?: number | null
          IdUsuarioSolicitante?: number
          NumeroSolicitud?: number
          Token?: string
        }
        Relationships: [
          {
            foreignKeyName: "Solicitudes_IdBodegaDestino_fkey"
            columns: ["IdBodegaDestino"]
            isOneToOne: false
            referencedRelation: "Bodegas"
            referencedColumns: ["IdBodega"]
          },
          {
            foreignKeyName: "Solicitudes_IdUsuarioAprobador_fkey"
            columns: ["IdUsuarioAprobador"]
            isOneToOne: false
            referencedRelation: "Usuarios"
            referencedColumns: ["IdUsuario"]
          },
          {
            foreignKeyName: "Solicitudes_IdUsuarioSolicitante_fkey"
            columns: ["IdUsuarioSolicitante"]
            isOneToOne: false
            referencedRelation: "Usuarios"
            referencedColumns: ["IdUsuario"]
          },
        ]
      }
      SolicitudesDetalle: {
        Row: {
          Cantidad: number
          CantidadAprobada: number | null
          CantidadRecibida: number
          IdProducto: number
          IdSolicitud: number
        }
        Insert: {
          Cantidad: number
          CantidadAprobada?: number | null
          CantidadRecibida?: number
          IdProducto: number
          IdSolicitud: number
        }
        Update: {
          Cantidad?: number
          CantidadAprobada?: number | null
          CantidadRecibida?: number
          IdProducto?: number
          IdSolicitud?: number
        }
        Relationships: [
          {
            foreignKeyName: "SolicitudesDetalle_IdProducto_fkey"
            columns: ["IdProducto"]
            isOneToOne: false
            referencedRelation: "Productos"
            referencedColumns: ["IdProducto"]
          },
          {
            foreignKeyName: "SolicitudesDetalle_IdSolicitud_fkey"
            columns: ["IdSolicitud"]
            isOneToOne: false
            referencedRelation: "Solicitudes"
            referencedColumns: ["IdSolicitud"]
          },
        ]
      }
      StockBodega: {
        Row: {
          Cantidad: number
          FechaModificacion: string
          IdBodega: number
          IdProducto: number
        }
        Insert: {
          Cantidad?: number
          FechaModificacion?: string
          IdBodega: number
          IdProducto: number
        }
        Update: {
          Cantidad?: number
          FechaModificacion?: string
          IdBodega?: number
          IdProducto?: number
        }
        Relationships: [
          {
            foreignKeyName: "StockBodega_IdBodega_fkey"
            columns: ["IdBodega"]
            isOneToOne: false
            referencedRelation: "Bodegas"
            referencedColumns: ["IdBodega"]
          },
          {
            foreignKeyName: "StockBodega_IdProducto_fkey"
            columns: ["IdProducto"]
            isOneToOne: false
            referencedRelation: "Productos"
            referencedColumns: ["IdProducto"]
          },
        ]
      }
      UnidadesMedida: {
        Row: {
          Codigo: string
          Factor: number
          factor_a_base: number
          FechaRegistroCreacion: string
          FechaRegistroModificacion: string
          IdEstado: number
          IdUnidadMedida: number
          IdUsuarioCreacion: number | null
          IdUsuarioModificacion: number | null
          Nombre: string
          UnidadBase: string
        }
        Insert: {
          Codigo: string
          Factor: number
          factor_a_base?: number
          FechaRegistroCreacion?: string
          FechaRegistroModificacion?: string
          IdEstado?: number
          IdUnidadMedida?: never
          IdUsuarioCreacion?: number | null
          IdUsuarioModificacion?: number | null
          Nombre: string
          UnidadBase: string
        }
        Update: {
          Codigo?: string
          Factor?: number
          factor_a_base?: number
          FechaRegistroCreacion?: string
          FechaRegistroModificacion?: string
          IdEstado?: number
          IdUnidadMedida?: never
          IdUsuarioCreacion?: number | null
          IdUsuarioModificacion?: number | null
          Nombre?: string
          UnidadBase?: string
        }
        Relationships: [
          {
            foreignKeyName: "UnidadesMedida_IdUsuarioCreacion_fkey"
            columns: ["IdUsuarioCreacion"]
            isOneToOne: false
            referencedRelation: "Usuarios"
            referencedColumns: ["IdUsuario"]
          },
          {
            foreignKeyName: "UnidadesMedida_IdUsuarioModificacion_fkey"
            columns: ["IdUsuarioModificacion"]
            isOneToOne: false
            referencedRelation: "Usuarios"
            referencedColumns: ["IdUsuario"]
          },
          {
            foreignKeyName: "UnidadesMedida_UnidadBase_fkey"
            columns: ["UnidadBase"]
            isOneToOne: false
            referencedRelation: "UnidadesMedida"
            referencedColumns: ["Codigo"]
          },
        ]
      }
      Usuarios: {
        Row: {
          Apellidos: string
          Correo: string
          FechaRegistroCreacion: string
          FechaRegistroModificacion: string
          IdEstado: number
          IdUsuario: number
          IdUsuarioCreacion: number | null
          IdUsuarioModificacion: number | null
          Nombres: string
          Rut: string
          Token: string
        }
        Insert: {
          Apellidos: string
          Correo: string
          FechaRegistroCreacion?: string
          FechaRegistroModificacion?: string
          IdEstado?: number
          IdUsuario?: never
          IdUsuarioCreacion?: number | null
          IdUsuarioModificacion?: number | null
          Nombres: string
          Rut: string
          Token?: string
        }
        Update: {
          Apellidos?: string
          Correo?: string
          FechaRegistroCreacion?: string
          FechaRegistroModificacion?: string
          IdEstado?: number
          IdUsuario?: never
          IdUsuarioCreacion?: number | null
          IdUsuarioModificacion?: number | null
          Nombres?: string
          Rut?: string
          Token?: string
        }
        Relationships: [
          {
            foreignKeyName: "Usuarios_IdUsuarioCreacion_fkey"
            columns: ["IdUsuarioCreacion"]
            isOneToOne: false
            referencedRelation: "Usuarios"
            referencedColumns: ["IdUsuario"]
          },
          {
            foreignKeyName: "Usuarios_IdUsuarioModificacion_fkey"
            columns: ["IdUsuarioModificacion"]
            isOneToOne: false
            referencedRelation: "Usuarios"
            referencedColumns: ["IdUsuario"]
          },
        ]
      }
      UsuariosRoles: {
        Row: {
          FechaRegistroCreacion: string
          FechaRegistroModificacion: string
          IdEstado: number
          IdRol: number
          IdUsuario: number
          IdUsuarioCreacion: number | null
          IdUsuarioModificacion: number | null
        }
        Insert: {
          FechaRegistroCreacion?: string
          FechaRegistroModificacion?: string
          IdEstado?: number
          IdRol: number
          IdUsuario: number
          IdUsuarioCreacion?: number | null
          IdUsuarioModificacion?: number | null
        }
        Update: {
          FechaRegistroCreacion?: string
          FechaRegistroModificacion?: string
          IdEstado?: number
          IdRol?: number
          IdUsuario?: number
          IdUsuarioCreacion?: number | null
          IdUsuarioModificacion?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "UsuariosRoles_IdRol_fkey"
            columns: ["IdRol"]
            isOneToOne: false
            referencedRelation: "Roles"
            referencedColumns: ["IdRol"]
          },
          {
            foreignKeyName: "UsuariosRoles_IdUsuario_fkey"
            columns: ["IdUsuario"]
            isOneToOne: false
            referencedRelation: "Usuarios"
            referencedColumns: ["IdUsuario"]
          },
          {
            foreignKeyName: "UsuariosRoles_IdUsuarioCreacion_fkey"
            columns: ["IdUsuarioCreacion"]
            isOneToOne: false
            referencedRelation: "Usuarios"
            referencedColumns: ["IdUsuario"]
          },
          {
            foreignKeyName: "UsuariosRoles_IdUsuarioModificacion_fkey"
            columns: ["IdUsuarioModificacion"]
            isOneToOne: false
            referencedRelation: "Usuarios"
            referencedColumns: ["IdUsuario"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      actualizar_solicitud: {
        Args: {
          p_bodega: number
          p_items: Json
          p_solicitud: number
          p_usuario: number
        }
        Returns: undefined
      }
      anular_factura: {
        Args: { p_compra: number; p_motivo: string; p_usuario: number }
        Returns: undefined
      }
      aprobar_solicitud: {
        Args: { p_items: Json; p_solicitud: number; p_usuario: number }
        Returns: undefined
      }
      buscar_subrecetas: {
        Args: { p_excluir: number; p_lim: number; p_q: string }
        Returns: Json
      }
      calcular_receta: { Args: { p_receta: number }; Returns: Json }
      calcular_receta_n: {
        Args: { p_nivel: number; p_receta: number }
        Returns: Json
      }
      calcular_recetas: { Args: { p_ids: number[] }; Returns: Json }
      cambiar_estado_solicitud: {
        Args: { p_nuevo: number; p_solicitud: number; p_usuario: number }
        Returns: undefined
      }
      convertir_territorio_texto: {
        Args: { p_ciudad: string; p_comuna: string; p_region: string }
        Returns: {
          ciudad: string
          comuna: string
          region: string
        }[]
      }
      crear_solicitud: {
        Args: { p_bodega: number; p_items: Json; p_usuario: number }
        Returns: number
      }
      crear_usuario: {
        Args: {
          p_actor: number
          p_apellidos: string
          p_correo: string
          p_hash: string
          p_nombres: string
          p_rol: number
          p_rut: string
        }
        Returns: number
      }
      etiqueta_producto: { Args: { p_id: number }; Returns: string }
      fijar_clave: {
        Args: {
          p_actor: number
          p_debe_cambiar: boolean
          p_hash: string
          p_usuario: number
        }
        Returns: undefined
      }
      guardar_receta: {
        Args: {
          p_cabecera: Json
          p_detalle: Json
          p_id: number
          p_usuario: number
        }
        Returns: number
      }
      guardar_rol: {
        Args: {
          p_detalle: string
          p_estado: number
          p_id: number
          p_nombre: string
          p_permisos: string[]
          p_usuario: number
        }
        Returns: number
      }
      listar_pagina: {
        Args: {
          p_estado: number
          p_lim: number
          p_off: number
          p_q: string
          p_tabla: string
        }
        Returns: Json
      }
      listar_solicitantes: { Args: never; Returns: Json }
      normalizar_busqueda: { Args: { p: string }; Returns: string }
      producto_de_item: { Args: { d: Json }; Returns: number }
      recepcionar_solicitud: {
        Args: { p_items: Json; p_solicitud: number; p_usuario: number }
        Returns: number
      }
      reclamar_correos: {
        Args: { p_max: number }
        Returns: {
          Asunto: string
          ClaveUnica: string | null
          Estado: number
          FechaEnvio: string | null
          FechaRegistroCreacion: string
          Html: string
          IdCorreo: number
          Intentos: number
          Para: string[]
          ProximoIntento: string
          UltimoError: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "CorreosPendientes"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      registrar_factura: {
        Args: {
          p_detalle: Json
          p_fecha_factura: string
          p_fecha_recepcion: string
          p_folio: number
          p_forma_pago: string
          p_iva: number
          p_neto: number
          p_proveedor: number
          p_total: number
          p_usuario: number
        }
        Returns: number
      }
      registrar_fallo_login: {
        Args: { p_bloqueo_min: number; p_max: number; p_usuario: number }
        Returns: undefined
      }
      registrar_intento_login: {
        Args: { p_clave: string; p_max: number; p_ventana_seg: number }
        Returns: boolean
      }
      resolver_correo: {
        Args: { p_error: string; p_id: number; p_max?: number; p_ok: boolean }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
