const Joi = require('joi');

const validateRequest = (schema) => {
  return (req, res, next) => {
    console.log(`🔍 VALIDATION: Validating request body:`, req.body);
    const { error } = schema.validate(req.body);

    if (error) {
      console.log(`❌ VALIDATION ERROR:`, error.details.map(detail => detail.message));
      return res.status(400).json({
        error: 'Validation error',
        details: error.details.map(detail => detail.message)
      });
    }

    console.log(`✅ VALIDATION SUCCESS: Request body is valid`);
    next();
  };
};

const schemas = {
  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required()
  }),

  register: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    role: Joi.string().valid('user', 'admin').default('user')
  }),

  createAlbum: Joi.object({
    title: Joi.string().required().max(255),
    description: Joi.string().optional().max(1000),
    date: Joi.date().optional(),
    tags: Joi.array().items(Joi.string()).optional(),
    location: Joi.string().optional().max(255),
    is_public: Joi.boolean().default(false)
  }),

  updateAlbum: Joi.object({
    title: Joi.string().optional().max(255),
    description: Joi.string().optional().max(1000),
    date: Joi.date().optional(),
    tags: Joi.array().items(Joi.string()).optional(),
    location: Joi.string().optional().max(255),
    is_public: Joi.boolean().optional(),
    cover_photo_id: Joi.string().uuid().optional().allow(null)
  }),

  createAccessLink: Joi.object({
    album_id: Joi.string().uuid().required(),
    expires_at: Joi.date().optional(),
    max_uses: Joi.number().integer().min(1).optional(),
    permission_type: Joi.string().valid('view', 'download').default('view')
  })
};

module.exports = {
  validateRequest,
  schemas
};