import React, {useEffect, useState}from 'react';


const BucketTest = () => {
    const idToken = localStorage.getItem('idToken');
    // const [isValid, setIsValid] = useState<boolean | null>(null);
    // const subId = localStorage.getItem("subId");
    const [errorMessage, setErrorMessage] = useState("");
    const [sub, setSub] = useState<string | null>(null);

    useEffect(() => {
        // if no token found, redirect to login page
        const fetchSub = async () => {          
            try {
            const response = await fetch("http://localhost:8080/subextract", {
                method: "POST",
                headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${idToken}`,
                },
            });
        
            if (response.ok) {
                // Parse the JSON for tokens
                const data = await response.json();
                console.log("sub received:", data);
                setSub(data)
            } else {
                // If not ok, show the error message
                const errorText = await response.text();
                setErrorMessage(errorText);
            }
            } catch (error) {
            setErrorMessage("An error occurred during login");
            }
        };
        if (idToken) {
            fetchSub();
            // if (sub)
            // {
            //   localStorage.setItem("subId", sub);
            // }
            

        }
        // veify token with backend, IMPORTANT (Might also need to pass IDToken)
        
    }, [idToken]);
    
   

    return (
        <div>
          {errorMessage ? (
            <p>{errorMessage}</p>
          ): 
          sub ? (
            <p>sub: {sub}</p>
          ): 
          (
            <p>Loading...</p>
          )}
        </div>
      );
};

export default BucketTest;