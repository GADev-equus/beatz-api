import { enrolmentOptions } from '../constants/enrolmentOptions.js';

export const getEnrolmentOptions = (_req, res) => {
  res.json(enrolmentOptions);
};
