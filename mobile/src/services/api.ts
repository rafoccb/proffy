import axios from 'axios';

const api = axios.create({
    baseURL: '192.168.1.109:3333'
})

export default api;