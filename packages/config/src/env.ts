export const DATABASE_URL =
  process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/tms'

export const API_PORT = process.env.API_PORT
  ? parseInt(process.env.API_PORT, 10)
  : 3001

export const EXPO_PUBLIC_API_URL =
  process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001'
