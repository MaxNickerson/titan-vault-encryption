// src/components/ViewFilesPage.js
import React, { useEffect, useState } from 'react';

const ViewFilesPage = () => {
    const [files, setFiles] = useState([]);

    useEffect(() => {
        // Fetch files from the server
        fetch('/api/files', {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${localStorage.getItem('authToken')}`, // Pass auth token
            },
        })
            .then((response) => response.json())
            .then((data) => setFiles(data))
            .catch((error) => console.error('Error fetching files:', error));
    }, []);

    return (
        <div className="h-screen bg-gradient-to-b from-blue-100 to-gray-100 flex flex-col">
            <header className="bg-blue-500 text-white py-4 px-8 shadow-md">
                <h1 className="text-2xl font-bold">My Files</h1>
            </header>
            <main className="flex-grow p-8">
                <h2 className="text-xl font-bold mb-4">Stored Encrypted Files</h2>
                <ul className="space-y-4">
                    {files.map((file) => (
                        <li key={file.id} className="bg-white p-4 rounded-lg shadow">
                            <p className="font-semibold">{file.fileName}</p>
                            <a
                                href={file.downloadUrl}
                                className="text-blue-500 underline"
                                download
                            >
                                Download
                            </a>
                        </li>
                    ))}
                </ul>
            </main>
        </div>
    );
};

export default ViewFilesPage;
