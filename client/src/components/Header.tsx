import { Link } from "react-router";

export const Header = () => {
    return (
        <div>
            <Link to="/api-transcribe-groq" >Api transcribe qroq</Link>
            <Link to="/api-transcribe">Api transcribe </Link>
            <Link to="/audio-extractor">Audio extractor</Link>
        </div>
    )
}