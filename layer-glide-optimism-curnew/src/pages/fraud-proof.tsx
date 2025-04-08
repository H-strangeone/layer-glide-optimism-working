import React from 'react';
import FraudProof from '../components/FraudProof';

const FraudProofPage: React.FC = () => {
    return (
        <div className="min-h-screen py-8">
            <div className="container mx-auto px-4">
                <h1 className="text-3xl font-bold mb-6 text-center bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">Fraud Proof Submission</h1>
                <FraudProof />
            </div>
        </div>
    );
};

export default FraudProofPage; 