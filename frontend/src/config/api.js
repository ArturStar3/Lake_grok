// Единая точка для задания базового URL API.
// Пустая строка VITE_API_URL = same-origin через nginx (см. docker-compose).
export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';
