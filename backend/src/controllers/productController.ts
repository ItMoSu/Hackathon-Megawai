import { Request, Response } from 'express';
import { prisma } from '../../lib/database/schema'; 

export const getProducts = async (req: Request, res: Response) => {
  try {
    const { user_id } = req.query; 

    if (!user_id) {
      return res.status(400).json({ error: "User ID wajib dikirim" });
    }

    const products = await prisma.products.findMany({
      where: { user_id: String(user_id) },
      orderBy: { created_at: 'desc' } 
    });

    res.json({ success: true, data: products });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Gagal mengambil data produk" });
  }
};

export const createProduct = async (req: Request, res: Response) => {
  try {
    const { user_id, name, unit } = req.body;

    if (!user_id || !name) {
      return res.status(400).json({ error: "User ID dan Nama Produk wajib diisi" });
    }

    const existing = await prisma.products.findFirst({
      where: { user_id, name }
    });

    if (existing) {
      return res.status(400).json({ error: "Produk dengan nama ini sudah ada" });
    }

    const newProduct = await prisma.products.create({
      data: {
        user_id,
        name,
        unit: unit || 'pcs', 
        is_active: true,
        dataset_id: null 
      }
    });

    res.status(201).json({ success: true, data: newProduct });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Gagal menyimpan produk" });
  }
};