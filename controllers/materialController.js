const Material = require('../models/Material');
const path = require('path');
const fs = require('fs');

// @desc    Upload material
// @route   POST /api/materials
// @access  Private (Teacher only)
const uploadMaterial = async (req, res) => {
  try {
    const { title, description, subject, type, semester, department } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload a file'
      });
    }

    const material = await Material.create({
      title,
      description,
      subject,
      type,
      fileUrl: '/uploads/' + req.file.filename,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      fileType: req.file.mimetype,
      semester: parseInt(semester),
      department,
      uploadedBy: req.user._id
    });

    await material.populate('uploadedBy', 'name');

    res.status(201).json({
      success: true,
      message: 'Material uploaded successfully',
      data: material
    });

  } catch (error) {
    console.error('Upload material error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get all materials
// @route   GET /api/materials
// @access  Private
const getMaterials = async (req, res) => {
  try {
    const { department, semester, subject, type, search } = req.query;

    const query = {};
    
    if (department) query.department = department;
    if (semester) query.semester = parseInt(semester);
    if (subject) query.subject = subject;
    if (type) query.type = type;
    
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { subject: { $regex: search, $options: 'i' } }
      ];
    }

    const materials = await Material.find(query)
      .populate('uploadedBy', 'name email')
      .sort('-createdAt');

    res.json({
      success: true,
      count: materials.length,
      data: materials
    });

  } catch (error) {
    console.error('Get materials error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get single material
// @route   GET /api/materials/:id
// @access  Private
const getMaterial = async (req, res) => {
  try {
    const material = await Material.findById(req.params.id)
      .populate('uploadedBy', 'name email');

    if (!material) {
      return res.status(404).json({
        success: false,
        message: 'Material not found'
      });
    }

    res.json({
      success: true,
      data: material
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    View/Download material (increment count)
// @route   GET /api/materials/:id/download
// @access  Private
const downloadMaterial = async (req, res) => {
  try {
    const material = await Material.findById(req.params.id);

    if (!material) {
      return res.status(404).json({
        success: false,
        message: 'Material not found'
      });
    }

    // Increment download count
    material.downloads += 1;
    await material.save();

    // Get file path
    const filePath = path.join(__dirname, '..', material.fileUrl);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'File not found on server'
      });
    }

    // Send file
    res.download(filePath, material.fileName);

  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    View material (for inline viewing - PDFs)
// @route   GET /api/materials/:id/view
// @access  Private
const viewMaterial = async (req, res) => {
  try {
    const material = await Material.findById(req.params.id);

    if (!material) {
      return res.status(404).json({
        success: false,
        message: 'Material not found'
      });
    }

    // Increment view count
    material.downloads += 1;
    await material.save();

    // Get file path
    const filePath = path.join(__dirname, '..', material.fileUrl);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'File not found on server'
      });
    }

    // Set content type
    const contentType = material.fileType || 'application/octet-stream';
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', 'inline; filename="' + material.fileName + '"');
    
    // Send file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);

  } catch (error) {
    console.error('View error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Update material
// @route   PUT /api/materials/:id
// @access  Private (Teacher only)
const updateMaterial = async (req, res) => {
  try {
    const { title, description, subject, type } = req.body;

    const material = await Material.findById(req.params.id);

    if (!material) {
      return res.status(404).json({
        success: false,
        message: 'Material not found'
      });
    }

    // Check authorization
    if (material.uploadedBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this material'
      });
    }

    if (title) material.title = title;
    if (description !== undefined) material.description = description;
    if (subject) material.subject = subject;
    if (type) material.type = type;

    await material.save();
    await material.populate('uploadedBy', 'name');

    res.json({
      success: true,
      message: 'Material updated successfully',
      data: material
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Delete material
// @route   DELETE /api/materials/:id
// @access  Private (Teacher only)
const deleteMaterial = async (req, res) => {
  try {
    const material = await Material.findById(req.params.id);

    if (!material) {
      return res.status(404).json({
        success: false,
        message: 'Material not found'
      });
    }

    // Check authorization (only uploader or admin can delete)
    if (material.uploadedBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this material'
      });
    }

    // Delete file from filesystem
    const filePath = path.join(__dirname, '..', material.fileUrl);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await material.deleteOne();

    res.json({
      success: true,
      message: 'Material deleted successfully'
    });

  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get material statistics
// @route   GET /api/materials/stats
// @access  Private (Teacher)
const getMaterialStats = async (req, res) => {
  try {
    const totalMaterials = await Material.countDocuments();
    const totalDownloads = await Material.aggregate([
      { $group: { _id: null, total: { $sum: '$downloads' } } }
    ]);

    const byType = await Material.aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ]);

    const byDepartment = await Material.aggregate([
      { $group: { _id: '$department', count: { $sum: 1 } } }
    ]);

    res.json({
      success: true,
      data: {
        totalMaterials,
        totalDownloads: totalDownloads[0]?.total || 0,
        byType,
        byDepartment
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  uploadMaterial,
  getMaterials,
  getMaterial,
  downloadMaterial,
  viewMaterial,
  updateMaterial,
  deleteMaterial,
  getMaterialStats
};