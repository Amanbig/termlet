import React from 'react'
import {createRoot} from 'react-dom/client'
import './style.css'
import App from './App'
import { ConfirmProvider } from './context/ConfirmContext'

const container = document.getElementById('root')

const root = createRoot(container!)

root.render(
    <React.StrictMode>
        <ConfirmProvider>
            <App/>
        </ConfirmProvider>
    </React.StrictMode>
)
