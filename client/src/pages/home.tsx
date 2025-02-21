import { useEffect } from "react"

export const Home = () => {

    useEffect(() => {
        fetch('/api/data') // Will proxy to http://localhost:5000/api/data
            .then(response => response.json())
            .then(data => console.log(data))
    })

    return (
        <div>HOmeee</div>
    )
}