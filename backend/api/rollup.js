const express = require('express');
const { verifyFraudProof } = require('../services/fraudProofService');
const router = express.Router();

router.post('/fraud-proof', async (req, res) => {
    const { batchId, fraudProof, merkleProof } = req.body;

    try {
        const isValid = await verifyFraudProof(batchId, fraudProof, merkleProof);

        if (!isValid) {
            return res.status(400).json({ isValid: false, message: 'Invalid fraud proof' });
        }

        // Mark the batch as fraudulent in the database (pseudo-code)
        // await markBatchAsFraudulent(batchId);

        res.json({ isValid: true, message: 'Fraud proof verified successfully' });
    } catch (error) {
        console.error('Error verifying fraud proof:', error);
        res.status(500).json({ isValid: false, message: 'Internal server error' });
    }
});

module.exports = router;
