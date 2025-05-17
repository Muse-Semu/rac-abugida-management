export interface Project {
  id: string
  title: string
  description: string
  image: string
  collaborators: string[]
  createdAt: string
  updatedAt: string
}

export interface Event {
  id: string
  title: string
  description: string
  image: string
  date: string
  location: string
  createdAt: string
  updatedAt: string
}

export interface User {
  id: string
  name: string
  email: string
  image: string
  role: "admin" | "user"
  createdAt: string
  updatedAt: string
} 