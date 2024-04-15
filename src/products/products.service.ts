import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { PaginationDto } from 'src/common/dtos/pagination.dto';
import { validate as IsUUID } from 'uuid';
import { title } from 'process';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger('ProductsService');
  constructor(
    // Injecta el manejador de base de datos
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}
  async create(createProductDto: CreateProductDto) {
    try {
      // Crea un nuevo producto
      // Usando el repositorio con la función create
      const product = this.productRepository.create(createProductDto);
      // Guarda el nuevo producto en la base de datos
      return await this.productRepository.save(product);
    } catch (error) {
      // Maneja las excepciones de la base de datos
      this.handleDBException(error);
    }
  }

  findAll(paginationDto: PaginationDto) {
    const { limit = 10, offset = 0 } = paginationDto;
    return this.productRepository.find({
      take: limit,
      skip: offset,
    });
  }

  async findOne(term: string) {
    let product: Product;
    if (IsUUID(term)) {
      product = await this.productRepository.findOneBy({ id: term });
    } else {
      const queryBuilder = this.productRepository.createQueryBuilder();
      product = await queryBuilder
        .where('LOWER(title)=:title or slug=:slug', {
          title: term.toLowerCase(),
          slug: term,
        })
        .getOne();
    }
    if (!product)
      throw new NotFoundException(`Product with term ${term} not found`);
    return product;
  }

  async update(id: string, updateProductDto: UpdateProductDto) {
    const product = await this.productRepository.preload({
      id: id,
      ...updateProductDto,
    });

    if (!product)
      throw new NotFoundException(`Product with id ${id} not found`);
    try {
      await this.productRepository.save(product);
      return product;
    } catch (error) {
      this.handleDBException(error);
    }
  }

  async remove(id: string) {
    const product = await this.findOne(id);
    await this.productRepository.remove(product);
  }

  private handleDBException(error: any) {
    // Si el error es un error 23505 (duplicado), lanza una excepción
    if (error.code === '23505') {
      throw new BadRequestException(error.detail);
    }
    // Caso contrario, lanza una excepción de servidor interno
    this.logger.error(error);
    throw new InternalServerErrorException(
      'Unexpected error, check server logs',
    );
  }
}
