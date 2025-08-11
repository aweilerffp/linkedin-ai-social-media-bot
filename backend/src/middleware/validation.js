import Joi from 'joi';
import { ApiError } from './errorHandler.js';

export const validateRequest = (schema) => {
  return (req, res, next) => {
    const { error } = Joi.object(schema).validate({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    if (error) {
      const errorMessage = error.details
        .map(detail => detail.message)
        .join(', ');
      
      return next(new ApiError(400, errorMessage));
    }

    next();
  };
};

export const validateBody = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body);

    if (error) {
      const errorMessage = error.details
        .map(detail => detail.message)
        .join(', ');
      
      return next(new ApiError(400, errorMessage));
    }

    req.body = value;
    next();
  };
};

export const validateQuery = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.query);

    if (error) {
      const errorMessage = error.details
        .map(detail => detail.message)
        .join(', ');
      
      return next(new ApiError(400, errorMessage));
    }

    req.query = value;
    next();
  };
};

export const validateParams = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.params);

    if (error) {
      const errorMessage = error.details
        .map(detail => detail.message)
        .join(', ');
      
      return next(new ApiError(400, errorMessage));
    }

    req.params = value;
    next();
  };
};